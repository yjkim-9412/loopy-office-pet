import AppKit
import CoreGraphics
import Foundation

// Finder windows always count, so Loopy can sit on one it is dropped on. With --ride, Excel, Word and
// PowerPoint windows do too.
let ride = CommandLine.arguments.contains("--ride")

func frontEdge(ride: Bool) -> String {
    let rideApps: Set<String> = ["com.microsoft.Excel", "com.microsoft.Word", "com.microsoft.Powerpoint"]
    guard let app = NSWorkspace.shared.frontmostApplication, let id = app.bundleIdentifier,
          id == "com.apple.finder" || (ride && rideApps.contains(id)),
          let items = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
            as? [[String: Any]] else { return "null" }
    for item in items {
        guard item[kCGWindowOwnerPID as String] as? Int32 == app.processIdentifier,
              item[kCGWindowLayer as String] as? Int == 0,
              let number = item[kCGWindowNumber as String] as? Int,
              let b = item[kCGWindowBounds as String] as? [String: NSNumber],
              let x=b["X"], let y=b["Y"], let w=b["Width"], let h=b["Height"],
              w.intValue >= 220, h.intValue >= 110 else { continue }
        return "{\"edge\":{\"x\":\(x.intValue),\"y\":\(y.intValue),\"width\":\(w.intValue),\"height\":\(h.intValue)},\"app\":null,\"window\":\(number)}"
    }
    return "null"
}
var previous = ""
repeat {
    let result = autoreleasepool { frontEdge(ride: ride) }
    if result != previous {
        print(result)
        fflush(stdout)
        previous = result
    }
    if CommandLine.arguments.contains("--once") { break }
    RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.35))
} while true
