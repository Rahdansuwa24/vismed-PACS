Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)

' Parameter 0 di akhir artinya jendela CMD dijalankan dalam mode tersembunyi (hidden)
WshShell.Run chr(34) & scriptDir & "\run_forwarder.bat" & chr(34), 0
Set WshShell = Nothing
