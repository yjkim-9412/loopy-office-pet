using System;
using System.Text;
using System.Runtime.InteropServices;
using System.Threading;
class ExplorerEdge {
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left, Top, Right, Bottom; }
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll",CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr h,StringBuilder name,int n);
    [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr h,out Rect r);
    [DllImport("user32.dll")] static extern bool SetProcessDpiAwarenessContext(IntPtr v);
    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("dwmapi.dll")] static extern int DwmGetWindowAttribute(IntPtr h,int attribute,out Rect bounds,int size);
    static string Read() {
        IntPtr h=GetForegroundWindow(); var name=new StringBuilder(80);
        if(h==IntPtr.Zero || IsIconic(h) || GetClassName(h,name,80)==0) return "null";
        if(name.ToString()!="CabinetWClass" && name.ToString()!="ExploreWClass") return "null";
        Rect r;
        if(DwmGetWindowAttribute(h,9,out r,Marshal.SizeOf(typeof(Rect)))!=0 && !GetWindowRect(h,out r)) return "null";
        return String.Format("{{\"x\":{0},\"y\":{1},\"width\":{2},\"height\":{3}}}",r.Left,r.Top,r.Right-r.Left,r.Bottom-r.Top);
    }
    static void Main(string[] args) {
        try { if(!SetProcessDpiAwarenessContext(new IntPtr(-4))) SetProcessDPIAware(); }
        catch(EntryPointNotFoundException) { SetProcessDPIAware(); }
        string previous=null;
        do {
            string current=Read();
            if(current!=previous) { Console.WriteLine(current); Console.Out.Flush(); previous=current; }
            if(args.Length>0 && args[0]=="--once") break;
            Thread.Sleep(350);
        } while(true);
    }
}
