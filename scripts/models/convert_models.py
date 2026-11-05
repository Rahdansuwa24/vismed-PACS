import os
import sys
import io
import torch
import math
import traceback
from pathlib import Path

# Force stdout and stderr to use UTF-8 to prevent cp1252 print crashes on Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

BASE_DIR = Path("d:/PA/vismed")
sys.path.append(str(BASE_DIR / "brain-stroke-segmentation"))

# --- ONNX Exporter Monkeypatches & Custom Symbolics ---
try:
    import torch.onnx._internal.torchscript_exporter.symbolic_opset9 as opset9
    import torch.onnx._internal.torchscript_exporter.symbolic_helper as symbolic_helper
    from torch.onnx._internal.torchscript_exporter.registration import registry

    # 1. Custom Unfold symbolic function
    original_unfold = opset9.unfold

    @symbolic_helper.parse_args("v", "i", "i", "i")
    def custom_unfold(g, input, dimension, size, step):
        sizes = symbolic_helper._get_tensor_sizes(input)
        try:
            sizedim = sizes[dimension]
        except Exception:
            sizedim = None
            
        if sizedim is None:
            # Fallback for Tuberculosis ViT model where input shape is not accessible
            if dimension in (2, 3):
                print(f"[MONKEYPATCH] custom_unfold: dimension {dimension} size is None in sizes {sizes}. Assuming 224.")
                sizedim = 224
            elif dimension == 0:
                print(f"[MONKEYPATCH] custom_unfold: batch dimension is None. Assuming 1.")
                sizedim = 1
            elif dimension == 1:
                print(f"[MONKEYPATCH] custom_unfold: channel dimension is None. Assuming 3.")
                sizedim = 3
                
        if sizedim is not None:
            low_indices = range(0, sizedim, step)
            hi_indices = range(size, sizedim + 1, step)
            stack = [
                symbolic_helper._slice_helper(
                    g, input, axes=[dimension], starts=[low], ends=[hi]
                )
                for low, hi in zip(low_indices, hi_indices)
            ]
            ndim = len(sizes)
            perm = list(range(ndim))
            perm.append(perm.pop(dimension))
            unsqueeze = [
                symbolic_helper._unsqueeze_helper(
                    g, g.op("Transpose", t, perm_i=perm), [dimension]
                )
                for t in stack
            ]
            return g.op("Concat", *unsqueeze, axis_i=dimension)
        else:
            return original_unfold(g, input, dimension, size, step)

    # 2. Custom Native Multi-Head Attention symbolic function
    def custom_native_mha(g, query, key, value, embed_dim, num_heads, in_proj_weight, in_proj_bias, out_proj_weight, out_proj_bias, mask, need_weights, average_attn_weights, mask_type=None):
        print("[MONKEYPATCH] custom_native_mha called.")
        
        # Parse inputs
        emb = symbolic_helper._parse_arg(embed_dim, 'i')
        heads = symbolic_helper._parse_arg(num_heads, 'i')
        head_dim = emb // heads
        
        # 1. Input projection
        in_proj_weight_T = g.op("Transpose", in_proj_weight, perm_i=[1, 0])
        projected = g.op("MatMul", query, in_proj_weight_T)
        projected = g.op("Add", projected, in_proj_bias)
        
        # 2. Split into Q, K, V
        q, k, v = g.op("Split", projected, num_outputs_i=3, axis_i=-1, outputs=3)
        
        # 3. Reshape to split heads (keep batch and seq_len dynamic via 0)
        shape_tensor = g.op("Constant", value_t=torch.tensor([0, -1, heads, head_dim], dtype=torch.long))
        q_reshaped = g.op("Reshape", q, shape_tensor)
        k_reshaped = g.op("Reshape", k, shape_tensor)
        v_reshaped = g.op("Reshape", v, shape_tensor)
        
        # 4. Transpose to (B, heads, L, head_dim)
        q_trans = g.op("Transpose", q_reshaped, perm_i=[0, 2, 1, 3])
        k_trans = g.op("Transpose", k_reshaped, perm_i=[0, 2, 1, 3])
        v_trans = g.op("Transpose", v_reshaped, perm_i=[0, 2, 1, 3])
        
        # 5. Attention scores Q @ K.T / sqrt(head_dim)
        k_trans_T = g.op("Transpose", k_trans, perm_i=[0, 1, 3, 2])
        scores = g.op("MatMul", q_trans, k_trans_T)
        
        scale_factor = g.op("Constant", value_t=torch.tensor([1.0 / math.sqrt(head_dim)], dtype=torch.float))
        scores_scaled = g.op("Mul", scores, scale_factor)
        
        # 6. Softmax
        attn_weights = g.op("Softmax", scores_scaled, axis_i=-1)
        
        # 7. Attention output
        context = g.op("MatMul", attn_weights, v_trans)
        
        # 8. Transpose and merge heads back
        context_trans = g.op("Transpose", context, perm_i=[0, 2, 1, 3])
        out_shape_tensor = g.op("Constant", value_t=torch.tensor([0, -1, emb], dtype=torch.long))
        context_merged = g.op("Reshape", context_trans, out_shape_tensor)
        
        # 9. Output projection
        out_proj_weight_T = g.op("Transpose", out_proj_weight, perm_i=[1, 0])
        output = g.op("MatMul", context_merged, out_proj_weight_T)
        output = g.op("Add", output, out_proj_bias)
        
        # 10. Average attention weights
        if g.opset < 18:
            avg_weights = g.op("ReduceMean", attn_weights, axes_i=[1], keepdims_i=0)
        else:
            avg_weights = g.op("ReduceMean", attn_weights, g.op("Constant", value_t=torch.tensor([1], dtype=torch.long)), keepdims_i=0)
            
        return output, avg_weights

    # Register custom symbolics for opset 9 to 20
    for opset in range(9, 21):
        registry.register("aten::unfold", opset, custom_unfold, custom=True)
        registry.register("aten::_native_multi_head_attention", opset, custom_native_mha, custom=True)
    print("[INIT] Custom ONNX unfold and native MHA symbolics registered successfully.")
except Exception as e:
    print(f"[WARNING] Failed to register custom ONNX symbolics: {e}")


def convert_tb_model():
    print("\n--- Converting Tuberculosis ViT Model ---")
    model_dir = BASE_DIR / "vision_models" / "sukhmani1303_tuberculosis-vit-model"
    model_path = model_dir / "model.pt"
    onnx_path = model_dir / "model.onnx"
    
    try:
        print(f"Loading TorchScript model from {model_path}...")
        model = torch.jit.load(str(model_path), map_location="cpu")
        model.eval()
        
        # Test input (static shape 1, 3, 224, 224)
        dummy_input = torch.randn(1, 3, 224, 224)
        print("Exporting to ONNX...")
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            input_names=["input"],
            output_names=["output"],
            opset_version=20,
            dynamo=False
        )
        print(f"[SUCCESS] Converted Tuberculosis model to {onnx_path}")
    except Exception as e:
        print(f"[ERROR] Failed to convert Tuberculosis model: {e}")
        traceback.print_exc()


def convert_stroke_lcnn_model():
    print("\n--- Converting Brain Stroke LCNN Model ---")
    model_dir = BASE_DIR / "vision_models" / "hoangtung386_brain-stroke-lcnn"
    weights_path = model_dir / "best_model.pth"
    onnx_path = model_dir / "model.onnx"
    
    try:
        from models.lcnn import LCNN
        print("Initializing LCNN model...")
        model = LCNN(num_channels=1, num_classes=2, global_impact=0.3, local_impact=0.7, T=1)
        
        print(f"Loading state dict from {weights_path}...")
        checkpoint = torch.load(str(weights_path), map_location="cpu")
        # Handle state dict key
        state_dict = checkpoint.get("model_state_dict", checkpoint)
        model.load_state_dict(state_dict)
        model.eval()
        
        # Input shape: (B, 2T+1, H, W) -> (1, 3, 512, 512)
        dummy_input = torch.randn(1, 3, 512, 512)
        print("Exporting to ONNX (using opset 20)...")
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            input_names=["input"],
            output_names=["output"],
            opset_version=20,
            dynamo=False
        )
        print(f"[SUCCESS] Converted LCNN model to {onnx_path}")
    except Exception as e:
        print(f"[ERROR] Failed to convert LCNN model: {e}")
        traceback.print_exc()


def convert_monai_lung_model():
    print("\n--- Converting MONAI Lung Nodule Model ---")
    model_dir = BASE_DIR / "vision_models" / "MONAI_lung_nodule_ct_detection"
    weights_path = model_dir / "models" / "model.pt"
    onnx_path = model_dir / "models" / "model.onnx"
    
    try:
        from monai.networks.nets.resnet import resnet50
        from monai.apps.detection.networks.retinanet_network import resnet_fpn_feature_extractor, RetinaNet
        
        print("Instantiating MONAI RetinaNet model from eager python definitions...")
        backbone = resnet50(spatial_dims=3, n_input_channels=1, conv1_t_stride=[2,2,1], conv1_t_size=[7,7,7])
        feature_extractor = resnet_fpn_feature_extractor(
            backbone=backbone,
            spatial_dims=3,
            pretrained_backbone=False,
            returned_layers=[1, 2],
            trainable_backbone_layers=None
        )
        model = RetinaNet(
            spatial_dims=3,
            num_classes=1,
            num_anchors=3,
            feature_extractor=feature_extractor,
            size_divisible=[16, 16, 8],
            use_list_output=False
        )
        
        print(f"Loading state dict from {weights_path}...")
        state_dict = torch.load(str(weights_path), map_location="cpu")
        model.load_state_dict(state_dict)
        model.eval()
        
        # Wrap model to return a flat tuple of tensors instead of dict of lists of tensors
        class MonaiEagerWrapper(torch.nn.Module):
            def __init__(self, net):
                super().__init__()
                self.net = net
                
            def forward(self, x):
                out = self.net(x)
                cls_list = out['classification']
                reg_list = out['box_regression']
                return (
                    cls_list[0], cls_list[1], cls_list[2],
                    reg_list[0], reg_list[1], reg_list[2]
                )
                
        wrapper = MonaiEagerWrapper(model)
        wrapper.eval()
        
        # Spatial input: (B, C, H, W, D) -> [1, 1, 256, 256, 96]
        # Keep spatial dimensions smaller for Windows memory limits
        dummy_input = torch.randn(1, 1, 256, 256, 96) 
        print("Exporting to ONNX...")
        torch.onnx.export(
            wrapper,
            dummy_input,
            str(onnx_path),
            input_names=["input"],
            output_names=[
                "cls_p3", "cls_p4", "cls_p5",
                "reg_p3", "reg_p4", "reg_p5"
            ],
            opset_version=20,
            dynamo=False
        )
        print(f"[SUCCESS] Converted MONAI model to {onnx_path}")
    except Exception as e:
        print(f"[ERROR] Failed to convert MONAI model: {e}")
        traceback.print_exc()


def convert_btx24_model():
    print("\n--- Converting BTX24 Beit Model ---")
    model_dir = BASE_DIR / "vision_models" / "BTX24_beit-base-patch16-224-pt22k-ft22k-finetuned-stroke-binary"
    onnx_path = model_dir / "model.onnx"
    
    try:
        from transformers import BeitForImageClassification
        from peft import LoraConfig, get_peft_model
        from safetensors.torch import load_file
        
        print("Loading base BEiT model from HF with 2 classes...")
        base_model = BeitForImageClassification.from_pretrained(
            "microsoft/beit-base-patch16-224-pt22k-ft22k",
            num_labels=2,
            ignore_mismatched_sizes=True
        )
        
        print("Initializing PEFT Lora model config...")
        config = LoraConfig(
            r=1000,
            lora_alpha=16,
            target_modules=r'.*\.query|.*\.value',
            lora_dropout=0.0,
            bias="none",
            modules_to_save=["classifier"]
        )
        model = get_peft_model(base_model, config)
        
        print(f"Loading weights from {model_dir}...")
        sd = load_file(str(model_dir / "model.safetensors"))
        
        # Prepend prefix to keys to match PEFT structure
        new_sd = {('base_model.model.' + k): v for k, v in sd.items()}
        model.load_state_dict(new_sd, strict=True)
        
        print("Merging adapter weights with base model...")
        model = model.merge_and_unload()
        model.eval()
        
        dummy_input = torch.randn(1, 3, 224, 224)
        print("Exporting to ONNX...")
        torch.onnx.export(
            model,
            dummy_input,
            str(onnx_path),
            input_names=["input"],
            output_names=["output"],
            opset_version=20,
            dynamo=False
        )
        print(f"[SUCCESS] Converted BTX24 model to {onnx_path}")
    except Exception as e:
        print(f"[ERROR] Failed to convert BTX24 model: {e}")
        traceback.print_exc()


if __name__ == "__main__":
    convert_tb_model()
    convert_stroke_lcnn_model()
    convert_monai_lung_model()
    convert_btx24_model()
