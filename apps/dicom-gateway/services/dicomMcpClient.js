let mcpClientPromise = null;

function parseArgs(value) {
  return String(value || "")
    .split(" ")
    .filter(Boolean);
}

async function getMcpClient() {
  if (mcpClientPromise) {
    return mcpClientPromise;
  }

  mcpClientPromise = (async function () {
    const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
    const { StdioClientTransport } = await import(
      "@modelcontextprotocol/sdk/client/stdio.js"
    );

    const client = new Client({
      name: "vismed-dicom-mcp-bridge",
      version: "1.0.0",
    });

    const transport = new StdioClientTransport({
      command: process.env.DICOM_MCP_COMMAND || "uv",
      args: parseArgs(
        process.env.DICOM_MCP_ARGS ||
          "run dicom-mcp configuration.yaml --transport stdio"
      ),
      cwd: process.env.DICOM_MCP_CWD || "/home/pacs/dicom-mcp/dicom-mcp",
    });

    await client.connect(transport);
    return client;
  })();

  return mcpClientPromise;
}

async function callDicomTool(name, args = {}) {
  const client = await getMcpClient();

  const result = await client.callTool({
    name,
    arguments: args,
  });

  if (result.isError) {
    throw new Error(JSON.stringify(result.content));
  }

  return result;
}

async function listTools() {
  const client = await getMcpClient();
  return client.listTools();
}

module.exports = {
  callDicomTool,
  listTools,
};
