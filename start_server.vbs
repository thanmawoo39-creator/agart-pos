Set WshShell = CreateObject("WScript.Shell")

' Backend Server ကို နောက်ကွယ်မှာ Run မယ်
' cmd /c ကိုသုံးပြီး npm run dev ကို ခေါ်ပါတယ်
WshShell.Run "cmd /c npm run dev", 0, False