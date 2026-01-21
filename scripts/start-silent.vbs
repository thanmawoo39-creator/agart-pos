' ============================================
' AgartPOS Silent Startup Script
' Runs the POS and Tunnel in background
' Place shortcut to this in Windows Startup folder
' Logs startup errors to startup.log
' ============================================

On Error Resume Next

Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get script directory
ScriptPath = WScript.ScriptFullName
ScriptDir = FSO.GetParentFolderName(ScriptPath)
ProjectDir = FSO.GetParentFolderName(ScriptDir)

' Ensure logs directory exists
LogsDir = ProjectDir & "\logs"
If Not FSO.FolderExists(LogsDir) Then
    FSO.CreateFolder(LogsDir)
End If

' Log file path
LogFile = LogsDir & "\startup.log"

' Function to write to log
Sub WriteLog(message)
    Set logStream = FSO.OpenTextFile(LogFile, 8, True)
    logStream.WriteLine Now & " - " & message
    logStream.Close
End Sub

' Start logging
WriteLog "============================================"
WriteLog "AgartPOS Silent Startup Initiated"
WriteLog "Project Directory: " & ProjectDir
WriteLog "============================================"

' Check if start-all.bat exists
StartAllPath = ScriptDir & "\start-all.bat"
If Not FSO.FileExists(StartAllPath) Then
    WriteLog "ERROR: start-all.bat not found at " & StartAllPath
    MsgBox "AgartPOS startup script not found!" & vbCrLf & StartAllPath, vbCritical, "AgartPOS Error"
    WScript.Quit 1
End If

' Run the master startup script minimized
' 7 = Minimized window, no focus
' False = Don't wait for script to finish
WriteLog "Starting: " & StartAllPath
result = WshShell.Run("""" & StartAllPath & """", 7, False)

If Err.Number <> 0 Then
    WriteLog "ERROR: Failed to start - " & Err.Description
    MsgBox "Failed to start AgartPOS: " & Err.Description, vbCritical, "AgartPOS Error"
    WScript.Quit 1
Else
    WriteLog "SUCCESS: Startup script launched (minimized)"
End If

WriteLog "Silent startup complete"
