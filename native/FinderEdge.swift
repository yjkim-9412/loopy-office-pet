import AppKit
import CoreGraphics
import Foundation

func finderEdge() -> String {
    guard let app = NSWorkspace.shared.frontmostApplication, app.bundleIdentifier == "com.apple.finder",
          let items = CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
            as? [[String: Any]] else { return "null" }
    for item in items {
        guard item[kCGWindowOwnerPID as String] as? Int32 == app.processIdentifier,
              item[kCGWindowLayer as String] as? Int == 0,
              let b = item[kCGWindowBounds as String] as? [String: NSNumber],
              let x=b["X"], let y=b["Y"], let w=b["Width"], let h=b["Height"],
              w.intValue >= 220, h.intValue >= 110 else { continue }
        return "{\"x\":\(x.intValue),\"y\":\(y.intValue),\"width\":\(w.intValue),\"height\":\(h.intValue)}"
    }
    return "null"
}
var previous = ""
repeat {
    let result = autoreleasepool { finderEdge() }
    if result != previous {
        print(result)
        fflush(stdout)
        previous = result
    }
    if CommandLine.arguments.contains("--once") { break }
    RunLoop.current.run(until: Date(timeIntervalSinceNow: 0.35))
} while true
