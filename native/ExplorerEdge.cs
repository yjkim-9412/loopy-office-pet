using System;
using System.Diagnostics;
using System.Text;
using System.Runtime.InteropServices;
using System.Threading;
class ExplorerEdge {
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder name,int n);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetWindowText(IntPtr h,StringBuilder text,int n);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h,out uint pid);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out Rect bounds,int size);
    static bool apps, titles;
    static uint lastPid; static string lastProcess;

    static string Edge(IntPtr h,string cls) {
        if(cls!="CabinetWClass" && cls!="ExploreWClass") return "null";
        Rect r;
        if(DwmGetWindowAttribute(h,9,out r,Marshal.SizeOf(typeof(Rect)))!=0 && !GetWindowRect(h,out r)) return "null";
        return String.Format("{{\"x\":{0},\"y\":{1},\"width\":{2},\"height\":{3}}}",r.Left,r.Top,r.Right-r.Left,r.Bottom-r.Top);
    }

    static string ProcessName(IntPtr h) {
        uint pid; GetWindowThreadProcessId(h,out pid);
        if(pid==lastPid) return lastProcess;
        lastPid=pid; lastProcess=null;
        try { using(var p=Process.GetProcessById((int)pid)) lastProcess=p.ProcessName.ToLowerInvariant(); }
        catch(Exception) {}
        return lastProcess;
    }

    // Only a category leaves this helper. A browser title is checked for a few fixed words and dropped at once.
    static string App(IntPtr h) {
        if(!apps) return null;
        string name=ProcessName(h);
        switch(name) {
            case "excel": return "excel";
            case "winword": return "word";
            case "powerpnt": return "powerpoint";
            case "outlook": case "olk": return "mail";
        }
        if(!titles || (name!="chrome" && name!="msedge" && name!="whale" && name!="firefox" && name!="brave")) return null;
        var text=new StringBuilder(512);
        GetWindowText(h,text,512);
        string title=text.ToString();
        if(title.Contains("Google Sheets") || title.Contains("Google 스프레드시트")) return "sheets";
        if(title.Contains("Google Docs") || title.Contains("Google 문서")) return "docs";
        if(title.Contains("Google Slides") || title.Contains("Google 프레젠테이션")) return "slides";
        if(title.Contains("Gmail")) return "mail";
        return null;
    }

    static string Read() {
        IntPtr h=GetForegroundWindow(); var cls=new StringBuilder(80);
        if(h==IntPtr.Zero || IsIconic(h) || GetClassName(h,cls,80)==0) return "{\"edge\":null,\"app\":null}";
        string app=App(h);
        return String.Format("{{\"edge\":{0},\"app\":{1}}}",Edge(h,cls.ToString()),app==null?"null":"\""+app+"\"");
    }

    static void Main(string[] args) {
        try { if(!SetProcessDpiAwarenessContext(new IntPtr(-4))) SetProcessDPIAware(); }
        catch(EntryPointNotFoundException) { SetProcessDPIAware(); }
        apps=Array.IndexOf(args,"--apps")>=0;
        titles=Array.IndexOf(args,"--titles")>=0;
        bool once=Array.IndexOf(args,"--once")>=0;
        string previous=null;
        do {
            string current=Read();
            if(current!=previous) { Console.WriteLine(current); Console.Out.Flush(); previous=current; }
            if(once) break;
            Thread.Sleep(350);
        } while(true);
    }
}
