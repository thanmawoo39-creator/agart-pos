Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c start_pos.bat", 0
Set WshShell = Nothing