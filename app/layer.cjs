// Where Loopy's windows sit among other windows.
// On top (default): above ordinary windows. On Windows any program can make its own window topmost too
// (some ERP clients and full-screen sites do), and the topmost window clicked last covers the rest, so
// every RAISE_MS Loopy asks to be topmost again, which puts it back in front. It skips that while one of
// Loopy's own menus is open, since the menu would end up under it.
// Off: an ordinary window that the window in use covers. It steps just above the window it is riding,
// and comes to the front while a talk bubble waits for an answer.
const RAISE_MS=2000;
const MENU_MS=60000;

function layerPlan({onTop,talking=false,platform,riding=null,menuOpen=false,tick=false}) {
  const top=Boolean(onTop||talking);
  return {
    top,
    level:top?(platform==='win32'?'screen-saver':'floating'):null,
    raise:top&&platform==='win32'&&tick&&!menuOpen,
    above:!top&&riding?`window:${riding}:0`:null
  };
}

module.exports={RAISE_MS,MENU_MS,layerPlan};
