Set WshShell = CreateObject("WScript.Shell")
' Parameter 0 di akhir artinya jendela CMD dijalankan dalam mode tersembunyi (hidden)
WshShell.Run chr(34) & "run_forwarder.bat" & Chr(34), 0
Set WshShell = Nothing
