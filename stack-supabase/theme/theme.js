/* Stack (Jorge + invitado) — paleta, sprites en pixel art, avatar animado, sonidos 8-bit, interacción y barra de juego */
(function () {
  Deck.C = {
    accent: "#1f7ff5", accentSoft: "#dbeafe", good: "#10b981", bad: "#ef4444", warn: "#f59e0b", info: "#6366f1",
    ink: "#0b0d10", muted: "#374151", faint: "#6b7280", line: "#e8eaed", surface: "#ffffff", dark: "#0b0d10",
    series: ["#6366f1", "#f59e0b", "#10b981", "#1f7ff5", "#ef4444", "#475569"],
  };

  var params = new URLSearchParams(location.search);
  var CAPTURE = params.has("static") || params.has("shot") || params.has("verify") || navigator.webdriver;
  var REDUCED = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var LIVE = !CAPTURE && !REDUCED;                         // animaciones de sprites
  var AUDIENCE = !CAPTURE && !params.has("presenter") && !params.has("follow"); // solo suena la ventana principal

  var O = "#0b0d10";
  var S = {
    door: { pal: { f: O, D: "currentColor", d: ["currentColor", "rgba(0,0,0,.24)"], y: "#fbbf24" }, rows: [
      "..ffffffffff..",
      ".ffDDDDDDDDff.",
      "ffDDDDDDDDDDff",
      "fDDDDDDDDDDDDf",
      "fDddddDDddddDf",
      "fDddddDDddddDf",
      "fDddddDDddddDf",
      "fDddddDDddddDf",
      "fDDDDDDDDDDDDf",
      "fDDDDDDDDDyyDf",
      "fDDDDDDDDDyyDf",
      "fDDDDDDDDDDDDf",
      "fDddddDDddddDf",
      "fDddddDDddddDf",
      "fDddddDDddddDf",
      "fDddddDDddddDf",
      "fDddddDDddddDf",
      "fDDDDDDDDDDDDf",
      "ffffffffffffff"] },
    cloud: { pal: { w: "#ffffff", c: "#d6e8fd" }, rows: [
      "........wwwww...........",
      "......wwwwwwwww.........",
      ".....wwwwwwwwwww..www...",
      "..wwwwwwwwwwwwwwwwwwwww.",
      ".wwwwwwwwwwwwwwwwwwwwwww",
      "wwwwwwwwwwwwwwwwwwwwwwww",
      "wwwwwwwwwwwwwwwwwwwwwwww",
      ".cccccccccccccccccccccc.",
      "..cccccccccccccccccccc.."] },
    boss: { pal: { o: O, r: "#ef4444", w: "#ffffff", e: O }, rows: [
      "....oooooooo....",
      "..oorrrrrrrroo..",
      ".orrrrrrrrrrrro.",
      ".orroorrrroorro.",
      "orrrrorrrrorrrro",
      "orrwwerrrrwwerro",
      "orrwwerrrrwwerro",
      "orrrrrrrrrrrrrro",
      "orrrrooooooorrro",
      "orrrowowowowrrro",
      ".orrrrrrrrrrrro.",
      "..oorrrrrrrroo..",
      "....oooooooo...."] },
    paper: { pal: { o: O, p: "#fff7e6", l: "#9ca3af" }, rows: [
      "..oooooooo..",
      ".oppppppppo.",
      ".opllllllpo.",
      ".oppppppppo.",
      ".opllllllpo.",
      ".oppppppppo.",
      ".oplllllppo.",
      ".oppppppppo.",
      ".opllllllpo.",
      ".oppppppppo.",
      "..oooooooo.."] },
    bubble: { pal: { o: O, w: "#ffffff", a: "#f59e0b" }, rows: [
      ".oooooooooo.",
      "owwwwwwwwwwo",
      "owwwwwwwwwwo",
      "owaawaawaawo",
      "owaawaawaawo",
      "owwwwwwwwwwo",
      ".oooowwooooo",
      "...oww......",
      "...oo......."] },
    rocket: { pal: { o: O, w: "#ffffff", b: "#1f7ff5", r: "#10b981", f: "#f59e0b" }, rows: [
      ".....oo.....",
      "....owwo....",
      "...owwwwo...",
      "...owbbwo...",
      "...owbbwo...",
      "...owwwwo...",
      "...owwwwo...",
      "..rowwwwor..",
      ".rrowwwworr.",
      ".rr.oooo.rr.",
      "....ffff....",
      ".....ff....."] },
    plane: { pal: { o: O, w: "#ffffff" }, rows: [
      "......oo......",
      ".o....owo.....",
      ".oo...owwo....",
      "owwwwwwwwwwwo.",
      ".oo...owwo....",
      ".o....owo.....",
      "......oo......"] },
    star: { pal: { y: "#fbbf24", o: O }, rows: [
      "....o....",
      "...oyo...",
      "ooooyoooo",
      "oyyyyyyyo",
      ".oyyyyyo.",
      "..oyyyo..",
      ".oyyoyyo.",
      ".oyo.oyo.",
      ".oo...oo."] },
    arrow: { pal: { y: "#fbbf24", o: O }, rows: [
      "..ooooo..",
      "..oyyyo..",
      "..oyyyo..",
      "ooooyoooo",
      ".oyyyyyo.",
      "..oyyyo..",
      "...oyo...",
      "....o...."] },
    land: {"pal": {"o": "#0b0d10", "g": "#4ade80", "G": "#22c55e", "d": "#a16207", "D": "#854d0e", "s": "#fde68a"}, "rows": ["......oooooooooooooooooooooooooooo......", "...ooogggGgggggGgggggggGggggGgggggooo...", ".oogGgggggggGgggggGggggggggggggGgggggoo.", "oggggggGgggggggggggggGgggggGggggggggGggo", "osssssssssssssssssssssssssssssssssssssso", ".oddDddddDddddddDdddddDddddddDddddDddo..", "..ooddddddDdddddddddDddddddddDdddddoo...", "....oooooddddDddddddddddDddddooooo......", ".........oooooooooooooooooooooo........."]},
    madrid: {"pal": {"o": "#0b0d10", "w": "#f5efe6", "W": "#d9cbb5", "r": "#c2410c", "y": "#fde047"}, "rows": ["....o.........................", "...oyo........................", "..owwwo.................oo....", ".owwWwwo................oo....", "owwwWwwwo..............owwo...", "owwwWwwwo..............owyo...", "ooooooooo..............owwo...", "owywwwywo....ooooooo...owyo...", "owywwwywo....owwwwwo...owwo...", "owwwwwwwoooooowyywyowoooowyoo.", "owywwwywowwwwowyywyowowwowwowo", "owywrwywowyywowwwwwowowywowyow", "owwwrwwwowyywowyywyowowwowwowo", "oooooooooooooooooooooooooooooo"]},
    atlanta: {"pal": {"o": "#0b0d10", "b": "#93c5fd", "B": "#60a5fa", "y": "#fde047", "g": "#cbd5e1", "G": "#94a3b8"}, "rows": ["..........o...................", "..........o...................", ".........ooo..................", ".........obo........o.........", "........obbbo......ooo........", "........obybo......obo........", "........obbbo.....obbbo.......", "...oo...obybo.....obybo.......", "..oggo..obbbo.....obbbo..oo...", "..ogyo..obybo.oo..obybo.oggo..", "..oggo..obbbooggo.obbbo.ogyo..", "..ogyo..obybooyggoobybo.oggo..", "..oggoo.obbboggggoobbbooogyo..", ".ooggggoobybogyggoobyboggggoo.", ".oggyggoobbbogggyoobbbogyggggo", ".oggggyoobybogyggoobybogggygo.", "oooooooooooooooooooooooooooooo"]},
    eyes: {"pal": {"y": "#fde047", "r": "#ef4444", "w": "#fff7cc"}, "rows": ["yy.........yy", "yyyy.....yyyy", ".yrwy...ywry.", "..yyy...yyy.."]},
    laptop: {"pal": {"o": "#0b0d10", "B": "#1f2937", "b": "#1f7ff5", "c": "#a7f3d0", "g": "#9ca3af"}, "rows": ["..oooooooooooo..", "..oBBBBBBBBBBo..", "..oBbbbbbbbbBo..", "..oBbcccbbbbBo..", "..oBbbbcccbbBo..", "..oBbccbbbbbBo..", "..oBbbbbbbbbBo..", "..oBBBBBBBBBBo..", "oooooooooooooooo", "oggggggggggggggo", ".oooooooooooooo."]},
    cap: {"pal": {"o": "#0b0d10", "K": "#1f2937", "k": "#374151", "y": "#fbbf24"}, "rows": ["......oo......", "....ooKKoo....", "..ooKKKKKKoo..", "ooKKKKKKKKKKoo", "..ooKKKKKKooy.", "...okkkkkko.y.", "...okkkkkko.y.", "....oooooo..yy", "............yy"]},
    flask: {"pal": {"o": "#0b0d10", "w": "#e0f2fe", "g": "#86efac", "G": "#22c55e"}, "rows": ["...oooo...", "...owwo...", "...owwo...", "...owwo...", "..owwwwo..", ".owwwwwwo.", "owggggggwo", "oggGgggGgo", "ogggggGggo", "ogGggggggo", ".oggggggo.", "..oooooo.."]},
    key: {"pal": {"o": "#0b0d10", "y": "#fbbf24"}, "rows": [".ooo..........", "oyyyo.........", "oy.yoooooooooo", "oy.yyyyyyyyyyo", "oyyyoooooyoyo.", ".ooo.....o.o.."]},
    briefcase: {"pal": {"o": "#0b0d10", "B": "#78350f", "b": "#b45309", "y": "#fbbf24"}, "rows": [".....oooo.....", "....o....o....", "oooooooooooooo", "oBBBBBBBBBBBBo", "oBBBBByyBBBBBo", "oooooooooooooo", "obbbbbbbbbbbbo", "obbbbbbbbbbbbo", "obbbbbbbbbbbbo", "oooooooooooooo"]},
    globe: {"pal": {"o": "#0b0d10", "b": "#3b82f6", "g": "#4ade80"}, "rows": ["...oooooo...", "..obbggbbo..", ".obgggbbbbo.", "obbggbbbggbo", "obbbgbbbgggo", "obbbbbbbbggo", "obggbbbbbbbo", "obgggbbbgbbo", ".obggbbbggo.", "..obbbbbbo..", "...oooooo..."]},
    suitcase: {"pal": {"o": "#0b0d10", "r": "#ec4899", "R": "#be185d"}, "rows": ["....oooo....", "....o..o....", ".oooooooooo.", ".orrrrrrrro.", ".orRrrrrRro.", ".orRrrrrRro.", ".orRrrrrRro.", ".orRrrrrRro.", ".orrrrrrrro.", ".oooooooooo.", "..oo....oo.."]},
    megaphone: {"pal": {"o": "#0b0d10", "r": "#ef4444", "y": "#fbbf24", "w": "#f8fafc"}, "rows": ["...........oo.", ".........oowo.", ".......oowwwo.", "oooooooowwwwo.", "orrroyywwwwwo.", "orrroyywwwwwo.", "oooooooowwwwo.", "...oo..oowwwo.", "...oo....oowo.", "...oo......oo."]},
    trophy: {"pal": {"o": "#0b0d10", "y": "#fbbf24", "Y": "#d97706", "B": "#92400e"}, "rows": ["oooooooooooo", "oyyyyyyyyyYo", "oyyyyyyyyyYo", ".oyyyyyyyYo.", "..oyyyyyYo..", "...oyyyYo...", "....oyYo....", "....oyYo....", "...oyyyYo...", "..oooooooo..", "..oBBBBBBo..", "..oooooooo.."]},
    chest: {"pal": {"o": "#0b0d10", "b": "#b45309", "B": "#78350f", "y": "#fbbf24"}, "rows": ["..oooooooooo..", ".oBbbbbbbbbBo.", "oBbbbbbbbbbbBo", "oooooooooooooo", "oBbbbbyybbbbBo", "oBbbbbyybbbbBo", "oBbbbbbbbbbbBo", "oBbbbbbbbbbbBo", "oooooooooooooo"]},
    heart: {"pal": {"o": "#0b0d10", "r": "#ef4444", "w": "#fecaca"}, "rows": [".oo...oo.", "orwo.orro", "orrrorrro", "orrrrrrro", ".orrrrro.", "..orrro..", "...oro...", "....o...."]},
    heart_empty: {"pal": {"o": "#0b0d10", "r": "#475569"}, "rows": [".oo...oo.", "orro.orro", "orrrorrro", "orrrrrrro", ".orrrrro.", "..orrro..", "...oro...", "....o...."]},
    coin: {"pal": {"o": "#0b0d10", "y": "#fbbf24", "Y": "#d97706", "w": "#fef3c7"}, "rows": ["..oooo..", ".oyyyyo.", "oywyyyYo", "oywyyyYo", "oyyyyyYo", "oyyyyyYo", ".oYYYYo.", "..oooo.."]},
    qblock: {"pal": {"o": "#0b0d10", "y": "#fbbf24", "Y": "#d97706"}, "rows": ["oooooooooooo", "oyyyyyyyyyyo", "oyyyooooyyYo", "oyyoyyyyoyYo", "oyyyyyyyoyYo", "oyyyyyyoyyYo", "oyyyyyoyyyYo", "oyyyyyoyyyYo", "oyyyyyyyyyYo", "oyyyyyoyyyYo", "oYYYYYYYYYYo", "oooooooooooo"]},
    mic: {"pal": {"o": "#0b0d10", "g": "#d1d5db", "G": "#6b7280"}, "rows": ["..oooo..", ".oggggo.", ".oGggGo.", ".oggggo.", ".oGggGo.", ".oggggo.", "o.oooo.o", "o......o", ".oo..oo.", "...oo...", "...oo...", ".oooooo."]},
    browser: {"pal": {"o": "#0b0d10", "w": "#ffffff", "R": "#ef4444", "Y": "#fbbf24", "G": "#22c55e", "b": "#1f7ff5", "g": "#cbd5e1"}, "rows": ["oooooooooooooo", "oRYGwwwwwwwwwo", "oooooooooooooo", "owwwwwwwwwwwwo", "owbbbbbwwwwwwo", "owwwwwwwwwwwwo", "owggggggggggwo", "owggggggwwwwwo", "owwwwwwwwwwwwo", "oooooooooooooo"]},
    xlogo: {"pal": {"o": "#0b0d10", "w": "#ffffff"}, "rows": ["oooooooooo", "owoooooowo", "oowoooowoo", "ooowoowooo", "oooowwoooo", "oooowwoooo", "ooowoowooo", "oowoooowoo", "owoooooowo", "oooooooooo"]},
    people: {"pal": {"o": "#0b0d10", "s": "#ecb894", "b": "#3b82f6", "y": "#f59e0b", "g": "#10b981"}, "rows": [".oo....oo....oo.", "osso..osso..osso", "osso..osso..osso", ".oo....oo....oo.", "obbo..oyyo..oggo", "obbboooyyoooggo.", "obbbo.oyyo.oggo.", "oooooooooooooooo"]},
    ghost: {"pal": {"o": "#0b0d10", "w": "currentColor", "E": "#ffffff", "p": "#0b0d10", "m": "#0b0d10"}, "rows": ["...oooooo...", "..owwwwwwo..", ".owwwwwwwwo.", ".owEEwwEEwo.", ".owEpwwEpwo.", ".owwwwwwwwo.", ".owwwmmwwwo.", ".owwwwwwwwo.", ".owwwwwwwwo.", ".owowwowwowo", ".oo.oo.oo.o."]},
  };
  S.vercel = {"pal":{"o":"#0b0d10"},"rows":["......oo......",".....oooo.....",".....oooo.....","....oooooo....","....oooooo....","...oooooooo...","...oooooooo...","..oooooooooo..","..oooooooooo..",".oooooooooooo.",".oooooooooooo.","oooooooooooooo"]};
  S.supabase = {"pal":{"o":"#0b0d10","g":"#3ecf8e","G":"#249361"},"rows":["......ooooo.",".....ogggo..","....ogggo...","...ogggo....","..oggggoooo.",".oggggggggo.",".ooooggGGgo.","....oggGo...","...oggGo....","..oggGo.....","..ogGo......",".ogo........",".oo........."]};
  S.branch = {"pal":{"o":"#0b0d10","a":"#6366f1","w":"#ffffff"},"rows":["..oooo........",".oaaaao.......",".oaaaao..oooo.",".oaaaao.oaaaao","..oooo..oaaaao","...oo...oaaaao","...oo....oooo.","...oo.....oo..","...oo....oo...","...oo..ooo....","...ooooo......","..oooo........",".oaaaao.......",".oaaaao.......",".oaaaao.......","..oooo........"]};
  S.door_open = { pal: { f: O, D: "#140f1f", d: "#140f1f", y: "#140f1f" }, rows: S.door.rows };

  /* ---------- avatar: fotogramas ---------- */
  var J = {"w":30,"h":42,"pal":{"o":"#2a1a12","H":"#3b2417","h":"#6b4429","l":"#8c5b36","d":"#1f120a","s":"#ecb894","S":"#d29a77","n":"#b8624c","B":"#3d2618","W":"#ffffff","e":"#16110e","t":"#f8f8f6","T":"#dcdcd6","j":"#cfa67a","J":"#a77f57","k":"#e3c39c","w":"#1c1c1e","p":"#8fb4e0","P":"#6c94c7","q":"#b6d0ef","x":"#ffffff","r":"#d6b98f","g":"#e6dccb"},"frames":{"idle":["..........oo.oooo.oo..........","........ooHhoHhhHoHhoo........",".......oHhlHHhlHHdHhlHo.......","......oHdhHHdhHhHdhHHdHo......",".....ohHhlHdHhlHdHhlHdHho.....",".....oHdHhHHlhHdHHhlHHdHo.....",".....oHhdhHlhHHdHhlHHdhHo.....",".....oHdhsHsssssshsHshdHo.....",".....oHHssssssssssssssHHo.....",".....oHssdddssssssdddssHo.....",".....oSssddssssssssddssSo.....",".....oSsssWessssssWesssSo.....",".....oSssseesssssseesssSo.....",".....ossssssssSSsssssssso.....","......oBssssBBBBBBssssBo......","......oBBssBBnnnnBBssBBo......","......oBBBBBBBBBBBBBBBBo......","........ooBBBBBBBBBBoo........","...........oSSSSSSo...........",".....oojjjjJttttttJjjjjoo.....","....ojjkjjjJttttttJjjjkjjo....","....ojjkjjjJttttttJjjjjjjo....","....ojjjjjjJttttttJJJJJjjo....","....ojjjjjjJttttttJjJjJjjo....","....ojjojjjJtttTttJJJJJojo....","....ojjojjjJtttTttJjjjjojo....","....ojjojjjJttttttJjjjjojo....","....ojjojjjJttttttJjjjjojo....","....ojjojjjJttttttJjjjjojo....","....ojjoJJJJJJJJJJJJJJowwo....","....ossooPPPPPPPPPPPPoosso....","....oSSooppqppPPppqppooSSo....",".....oo.opqpppoopppqpo.oo.....","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"blink":["..........oo.oooo.oo..........","........ooHhoHhhHoHhoo........",".......oHhlHHhlHHdHhlHo.......","......oHdhHHdhHhHdhHHdHo......",".....ohHhlHdHhlHdHhlHdHho.....",".....oHdHhHHlhHdHHhlHHdHo.....",".....oHhdhHlhHHdHhlHHdhHo.....",".....oHdhsHsssssshsHshdHo.....",".....oHHssssssssssssssHHo.....",".....oHssdddssssssdddssHo.....",".....oSssddssssssssddssSo.....",".....oSssssssssssssssssSo.....",".....oSsssddssssssddsssSo.....",".....ossssssssSSsssssssso.....","......oBssssBBBBBBssssBo......","......oBBssBBnnnnBBssBBo......","......oBBBBBBBBBBBBBBBBo......","........ooBBBBBBBBBBoo........","...........oSSSSSSo...........",".....oojjjjJttttttJjjjjoo.....","....ojjkjjjJttttttJjjjkjjo....","....ojjkjjjJttttttJjjjjjjo....","....ojjjjjjJttttttJJJJJjjo....","....ojjjjjjJttttttJjJjJjjo....","....ojjojjjJtttTttJJJJJojo....","....ojjojjjJtttTttJjjjjojo....","....ojjojjjJttttttJjjjjojo....","....ojjojjjJttttttJjjjjojo....","....ojjojjjJttttttJjjjjojo....","....ojjoJJJJJJJJJJJJJJowwo....","....ossooPPPPPPPPPPPPoosso....","....oSSooppqppPPppqppooSSo....",".....oo.opqpppoopppqpo.oo.....","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"wave1":["..........oo.oooo.oo..........","........ooHhoHhhHoHhoo........",".......oHhlHHhlHHdHhlHo.......","......oHdhHHdhHhHdhHHdHo......",".....ohHhlHdHhlHdHhlHdHho.....",".....oHdHhHHlhHdHHhlHHdHo.....",".....oHhdhHlhHHdHhlHHdhHo.....",".....oHdhsHsssssshsHshdHo.....",".....oHHssssssssssssssHHo.....","...oo.HssdddssssssdddssHo.....","..ossoSssddssssssssddssSo.....","..ossoSsssWessssssWesssSo.....","..ossoSssseesssssseesssSo.....","..oSSossssssssSSsssssssso.....","..oJJooBssssBBBBBBssssBo......","..ojjooBBssBBnnnnBBssBBo......","..ojjooBBBBBBBBBBBBBBBBo......","..ojjo..ooBBBBBBBBBBoo........","..ojjo.....oSSSSSSo...........","..ojjoojjjjJttttttJjjjjoo.....","..ojjojkjjjJttttttJjjjkjjo....",".......ojjjJttttttJjjjjjjo....",".......ojjjJttttttJJJJJjjo....",".......ojjjJttttttJjJjJjjo....",".......ojjjJtttTttJJJJJojo....",".......ojjjJtttTttJjjjjojo....",".......ojjjJttttttJjjjjojo....",".......ojjjJttttttJjjjjojo....",".......ojjjJttttttJjjjjojo....",".......oJJJJJJJJJJJJJJowwo....",".......ooPPPPPPPPPPPPoosso....",".......ooppqppPPppqppooSSo....",".......oopqpppoopppqpo.oo.....","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"wave2":["..........oo.oooo.oo..........","........ooHhoHhhHoHhoo........",".......oHhlHHhlHHdHhlHo.......","......oHdhHHdhHhHdhHHdHo......",".....ohHhlHdHhlHdHhlHdHho.....",".....oHdHhHHlhHdHHhlHHdHo.....",".....oHhdhHlhHHdHhlHHdhHo.....",".....oHdhsHsssssshsHshdHo.....",".....oHHssssssssssssssHHo.....","..oo.oHssdddssssssdddssHo.....",".ossooSssddssssssssddssSo.....",".ossooSsssWessssssWesssSo.....",".ossooSssseesssssseesssSo.....",".oSSoossssssssSSsssssssso.....","..oJJooBssssBBBBBBssssBo......","..ojjooBBssBBnnnnBBssBBo......","..ojjooBBBBBBBBBBBBBBBBo......","..ojjo..ooBBBBBBBBBBoo........","..ojjo.....oSSSSSSo...........","..ojjoojjjjJttttttJjjjjoo.....","..ojjojkjjjJttttttJjjjkjjo....",".......ojjjJttttttJjjjjjjo....",".......ojjjJttttttJJJJJjjo....",".......ojjjJttttttJjJjJjjo....",".......ojjjJtttTttJJJJJojo....",".......ojjjJtttTttJjjjjojo....",".......ojjjJttttttJjjjjojo....",".......ojjjJttttttJjjjjojo....",".......ojjjJttttttJjjjjojo....",".......oJJJJJJJJJJJJJJowwo....",".......ooPPPPPPPPPPPPoosso....",".......ooppqppPPppqppooSSo....",".......oopqpppoopppqpo.oo.....","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"cheer":["..........oo.oooo.oo..........","........ooHhoHhhHoHhoo........",".......oHhlHHhlHHdHhlHo.......","......oHdhHHdhHhHdhHHdHo......",".....ohHhlHdHhlHdHhlHdHho.....",".....oHdHhHHlhHdHHhlHHdHo.....",".....oHhdhHlhHHdHhlHHdhHo.....",".....oHdhsHsssssshsHshdHo.....",".....oHHssssssssssssssHHo.....","...oo.HssdddssssssdddssH.oo...","..ossoSssddssssssssddssSosso..","..ossoSsssWessssssWesssSosso..","..ossoSssseesssssseesssSosso..","..oSSossssssssSSssssssssoSSo..","..oJJooBssssBBBBBBssssBoowwo..","..ojjooBBssBBnnnnBBssBBoojjo..","..ojjooBBBBBBBBBBBBBBBBoojjo..","..ojjo..ooBBBBBBBBBBoo..ojjo..","..ojjo.....oSSSSSSo.....ojjo..","..ojjoojjjjJttttttJjjjjoojjo..","..ojjojkjjjJttttttJjjjkjojjo..",".......ojjjJttttttJjjjo.......",".......ojjjJttttttJJJJo.......",".......ojjjJttttttJjJjo.......",".......ojjjJtttTttJJJJo.......",".......ojjjJtttTttJjjjo.......",".......ojjjJttttttJjjjo.......",".......ojjjJttttttJjjjo.......",".......ojjjJttttttJjjjo.......",".......oJJJJJJJJJJJJJJo.......",".......ooPPPPPPPPPPPPoo.......",".......ooppqppPPppqppoo.......",".......oopqpppoopppqpoo.......","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"side1":["..............................","..............................","..............................","..............................","...........oo.ooo.oo..........",".........ooHhoHhhHoHoo........","........oHhlHHhlHHdHhHo.......",".......oHdhHHdhHhHdhHHHo......","......ohHhlHdHhlHdHhlHHHo.....","......oHdHhHHlhHdHHhlHhHo.....","......oHhHdhHlhHHdHhsHsso.....","......oHdHHhHHHhHssssdddo.....","......oHHdHHSSsssssdddso......","......oHHHHSSSssssssWeso......","......oHHHHSSsssssssseso......","......ooHHHssssssssssssso.....","......oBHHsssssssssssSSo......",".......oBBssssssssBBBBBo......",".......oBBBsssssssBnnBo.......",".......oBBBBBBBBBBBBBBo.......","........ooBBBBBBBBBBoo........","............oSSSSo............","..........oojjjjjjJtto........","..........ojjoJjojJttto.......","..........ojjoJjojJttto.......","..........ojjoJjojJttto.......","..........ojjoJjojJttto.......","..........ojjjoJjoJttto.......","..........ojjjoJjoJttto.......","..........ojjjoJjoJttto.......","..........ojjjoJjoJttto.......","..........oJJJossoJJJJo.......","..........oPPP.oo.PPPPo.......","..........oppqppppqpppo.......","...........opqppppqppo........","..........opqppo.oppqpo.......",".........opqppo...oppqpo......","........opqppo.....oppqpo.....",".......oPPPPo.......oPPPPo....","......oxxrrxo.......oxxrrxxo..","......oggggggo......ogggggggo.","......ooooooo.......oooooooo.."],"side2":["..............................","..............................","..............................","..............................","...........oo.ooo.oo..........",".........ooHhoHhhHoHoo........","........oHhlHHhlHHdHhHo.......",".......oHdhHHdhHhHdhHHHo......","......ohHhlHdHhlHdHhlHHHo.....","......oHdHhHHlhHdHHhlHhHo.....","......oHhHdhHlhHHdHhsHsso.....","......oHdHHhHHHhHssssdddo.....","......oHHdHHSSsssssdddso......","......oHHHHSSSssssssWeso......","......oHHHHSSsssssssseso......","......ooHHHssssssssssssso.....","......oBHHsssssssssssSSo......",".......oBBssssssssBBBBBo......",".......oBBBsssssssBnnBo.......",".......oBBBBBBBBBBBBBBo.......","........ooBBBBBBBBBBoo........","............oSSSSo............","..........oojjjjjjJtto........","..........ooJjojjjJttto.......","..........ooJjojjjJttto.......","..........ooJjojjjJttto.......","..........ooJjojjjJttto.......","..........oJjojjjjJttto.......","..........oJjojjjjJttto.......","..........oJjojjjjJttto.......","..........oJjojjjjJttto.......","..........ossoJJJJJJJJo.......","...........oo.PPPPPPPPo.......","..........oppqppppqpppo.......","...........opqppqpppo.........","...........opqppqpppo.........","............opqpqppo..........","............opqpqppo..........","............oPPPPPPo..........","............oxxrrxxxxo........","............oggggggggo........","............oooooooooo........"]}};
  var J2 = {"w":30,"h":42,"pal":{"o":"#1f1712","H":"#6e5338","h":"#8a6a48","l":"#a98760","d":"#4a3624","b":"#5a4028","s":"#f2caa9","S":"#dba584","c":"#eaa995","n":"#d08a7d","W":"#ffffff","e":"#3a2414","N":"#1d2540","M":"#2c3760","K":"#121830","u":"#3d4a78","p":"#d8c29c","P":"#b49b74","q":"#e9d9bb","x":"#ffffff","r":"#9aa3b2","g":"#e6dccb","C":"#34406b","Y":"#5b3a24"},"frames":{"idle":["..........oooooooooo..........","........oolhhlllhhhhoo........",".......olhhllhhllhhhhho.......","......ohlhhlhhhlhhhlhhHo......",".....oHhhlhhHhhlhhhHhhdHo.....",".....odHhHHhHHhHHHhHHHdHo.....",".....odHHHdHHHHHdHHHHdHdo.....",".....oHHHSssssssssssSHHdo.....",".....oHdssssssssssssssdHo.....",".....odssbbbssssssbbbssdo.....","....oodssbssssssssssbssdoo....","....oSSsssWessssssWesssSSo....","....oSSssseesssssseesssSSo....","....ooSsssssssSSsssssssSoo....",".....oSsccssssssssssccsSo.....",".....oSssssssSnnSssssssSo.....","......oSssssssssssssssSo......","........oossssssssssoo........","..........ooSSSSSSoo..........",".....ooNNNNCCSssSCCNNNNoo.....","....oNNMNNNNCSssSCNNNNMNNo....","....oNNMNNNNNCSSCNNNNNMNNo....","....oNNMNNNNNNuuNNNNNNMNNo....","....oNNMNNNNNNKKNNNNNNMNNo....","....oKKoNNNNNNuuNNNNNNoKKo....","....ossoNNNNNNKKNNNNNNosso....","....ossoNNNNNNNNNNNNNNosso....","....oSsoNNNNNNNNNNNNNNoSso....","....oSsoMNNNNNNNNNNNNMoSso....","....oSsoKKKKKKKKKKKKKKoSso....","....ossooYYYYYYYYYYYYoosso....","....oSSooppqppPPppqppooSSo....",".....oo.opqpppoopppqpo.oo.....","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"wave1":["..........oooooooooo..........","........oolhhlllhhhhoo........",".......olhhllhhllhhhhho.......","......ohlhhlhhhlhhhlhhHo......",".....oHhhlhhHhhlhhhHhhdHo.....",".....odHhHHhHHhHHHhHHHdHo.....",".....odHHHdHHHHHdHHHHdHdo.....",".....oHHHSssssssssssSHHdo.....",".....oHdssssssssssssssdHo.....","...ooodssbbbssssssbbbssdo.....","..ossodssbssssssssssbssdoo....","..ossSSsssWessssssWesssSSo....","..ossSSssseesssssseesssSSo....","..oSSoSsssssssSSsssssssSoo....","..oSSoSsccssssssssssccsSo.....","..ossoSssssssSnnSssssssSo.....","..ossooSssssssssssssssSo......","..osso..oossssssssssoo........","..oNNo....ooSSSSSSoo..........","..oNNooNNNNCCSssSCCNNNNoo.....","..oNNoNMNNNNCSssSCNNNNMNNo....",".......oNNNNNCSSCNNNNNMNNo....",".......oNNNNNNuuNNNNNNMNNo....",".......oNNNNNNKKNNNNNNMNNo....",".......oNNNNNNuuNNNNNNoKKo....",".......oNNNNNNKKNNNNNNosso....",".......oNNNNNNNNNNNNNNosso....",".......oNNNNNNNNNNNNNNoSso....",".......oMNNNNNNNNNNNNMoSso....",".......oKKKKKKKKKKKKKKoSso....",".......ooYYYYYYYYYYYYoosso....",".......ooppqppPPppqppooSSo....",".......oopqpppoopppqpo.oo.....","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"wave2":["..........oooooooooo..........","........oolhhlllhhhhoo........",".......olhhllhhllhhhhho.......","......ohlhhlhhhlhhhlhhHo......",".....oHhhlhhHhhlhhhHhhdHo.....",".....odHhHHhHHhHHHhHHHdHo.....",".....odHHHdHHHHHdHHHHdHdo.....",".....oHHHSssssssssssSHHdo.....",".....oHdssssssssssssssdHo.....","..oo.odssbbbssssssbbbssdo.....",".ossoodssbssssssssssbssdoo....",".ossoSSsssWessssssWesssSSo....",".ossoSSssseesssssseesssSSo....",".oSSooSsssssssSSsssssssSoo....","..oSSoSsccssssssssssccsSo.....","..ossoSssssssSnnSssssssSo.....","..ossooSssssssssssssssSo......","..osso..oossssssssssoo........","..oNNo....ooSSSSSSoo..........","..oNNooNNNNCCSssSCCNNNNoo.....","..oNNoNMNNNNCSssSCNNNNMNNo....",".......oNNNNNCSSCNNNNNMNNo....",".......oNNNNNNuuNNNNNNMNNo....",".......oNNNNNNKKNNNNNNMNNo....",".......oNNNNNNuuNNNNNNoKKo....",".......oNNNNNNKKNNNNNNosso....",".......oNNNNNNNNNNNNNNosso....",".......oNNNNNNNNNNNNNNoSso....",".......oMNNNNNNNNNNNNMoSso....",".......oKKKKKKKKKKKKKKoSso....",".......ooYYYYYYYYYYYYoosso....",".......ooppqppPPppqppooSSo....",".......oopqpppoopppqpo.oo.....","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"cheer":["..........oooooooooo..........","........oolhhlllhhhhoo........",".......olhhllhhllhhhhho.......","......ohlhhlhhhlhhhlhhHo......",".....oHhhlhhHhhlhhhHhhdHo.....",".....odHhHHhHHhHHHhHHHdHo.....",".....odHHHdHHHHHdHHHHdHdo.....",".....oHHHSssssssssssSHHdo.....",".....oHdssssssssssssssdHo.....","...ooodssbbbssssssbbbssdooo...","..ossodssbssssssssssbssdosso..","..ossSSsssWessssssWesssSSsso..","..ossSSssseesssssseesssSSsso..","..oSSoSsssssssSSsssssssSoSSo..","..oSSoSsccssssssssssccsSoSSo..","..ossoSssssssSnnSssssssSosso..","..ossooSssssssssssssssSoosso..","..osso..oossssssssssoo..osso..","..oNNo....ooSSSSSSoo....oNNo..","..oNNooNNNNCCSssSCCNNNNooNNo..","..oNNoNMNNNNCSssSCNNNNMNoNNo..",".......oNNNNNCSSCNNNNNo.......",".......oNNNNNNuuNNNNNNo.......",".......oNNNNNNKKNNNNNNo.......",".......oNNNNNNuuNNNNNNo.......",".......oNNNNNNKKNNNNNNo.......",".......oNNNNNNNNNNNNNNo.......",".......oNNNNNNNNNNNNNNo.......",".......oMNNNNNNNNNNNNMo.......",".......oKKKKKKKKKKKKKKo.......",".......ooYYYYYYYYYYYYoo.......",".......ooppqppPPppqppoo.......",".......oopqpppoopppqpoo.......","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"],"blink":["..........oooooooooo..........","........oolhhlllhhhhoo........",".......olhhllhhllhhhhho.......","......ohlhhlhhhlhhhlhhHo......",".....oHhhlhhHhhlhhhHhhdHo.....",".....odHhHHhHHhHHHhHHHdHo.....",".....odHHHdHHHHHdHHHHdHdo.....",".....oHHHSssssssssssSHHdo.....",".....oHdssssssssssssssdHo.....",".....odssbbbssssssbbbssdo.....","....oodssbssssssssssbssdoo....","....oSSssssssssssssssssSSo....","....oSSssseesssssseesssSSo....","....ooSsssssssSSsssssssSoo....",".....oSsccssssssssssccsSo.....",".....oSssssssSnnSssssssSo.....","......oSssssssssssssssSo......","........oossssssssssoo........","..........ooSSSSSSoo..........",".....ooNNNNCCSssSCCNNNNoo.....","....oNNMNNNNCSssSCNNNNMNNo....","....oNNMNNNNNCSSCNNNNNMNNo....","....oNNMNNNNNNuuNNNNNNMNNo....","....oNNMNNNNNNKKNNNNNNMNNo....","....oKKoNNNNNNuuNNNNNNoKKo....","....ossoNNNNNNKKNNNNNNosso....","....ossoNNNNNNNNNNNNNNosso....","....oSsoNNNNNNNNNNNNNNoSso....","....oSsoMNNNNNNNNNNNNMoSso....","....oSsoKKKKKKKKKKKKKKoSso....","....ossooYYYYYYYYYYYYoosso....","....oSSooppqppPPppqppooSSo....",".....oo.opqpppoopppqpo.oo.....","........opqpppoopppqpo........","........opqpppoopppqpo........","........opqpppoopppqpo........",".......opqppppoppppqpo........",".......oPPPPPPooPPPPPPo.......",".......oxxxrrxooxrrxxxo.......","......oxxrrxxxooxxxrrxxo......","......oggggggggoggggggggo.....","......oooooooooooooooooo......"]}};
  var CH = { jorge: J, invitado: J2 };
  var CHSEL = Object.keys(CH).map(function (k) { return '.slide.is-active [data-px="' + k + '"]'; }).join(", ") + ', #footer [data-px="jorge"]';
  function runs(pal, rows) {
    var out = [];
    rows.forEach(function (row, y) {
      var x = 0;
      while (x < row.length) {
        var c = row[x], n = 1;
        while (x + n < row.length && row[x + n] === c) n++;
        if (c !== "." && pal[c]) [].concat(pal[c]).forEach(function (f) { out.push('<rect x="' + x + '" y="' + y + '" width="' + n + '" height="1" fill="' + f + '"/>'); });
        x += n;
      }
    });
    return out.join("");
  }
  function svg(name) {
    var sp = S[name]; if (!sp) return "";
    var w = 0; sp.rows.forEach(function (r) { w = Math.max(w, r.length); });
    return '<svg viewBox="0 0 ' + w + " " + sp.rows.length + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + runs(sp.pal, sp.rows) + "</svg>";
  }
  Deck.pxSvg = svg;

  var ANIM = {
    idle: [["idle", 2600], ["blink", 130], ["idle", 1500], ["blink", 130]],
    wave: [["wave1", 240], ["wave2", 240]],
    walk: [["side1", 170], ["side2", 170]],
    cheer: [["cheer", 380], ["idle", 380]],
  };
  function frameG(ch, name) { return '<g data-f="' + name + '">' + runs(ch.pal, ch.frames[name]) + "</g>"; }
  function renderChar(el) {
    var ch = el._ch = CH[el.getAttribute("data-px")];
    var a = ANIM[el.getAttribute("data-anim")] ? el.getAttribute("data-anim") : "idle";
    var first = ANIM[a][0][0]; if (!ch.frames[first]) first = "idle";
    el.innerHTML = '<svg viewBox="0 0 ' + ch.w + " " + ch.h + '" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' + frameG(ch, first) + "</svg>";
    el._cur = first;
    el.setAttribute("data-noclick", "");
    el.classList.add("px-me");
  }
  function setFrame(el, name) {
    if (el._ch && !el._ch.frames[name]) name = "idle";
    if (el._cur === name || !el.firstElementChild) return;
    var s = el.firstElementChild, g = s.querySelector('g[data-f="' + name + '"]');
    if (!g) { s.insertAdjacentHTML("beforeend", frameG(el._ch || J, name)); g = s.lastElementChild; }
    s.querySelectorAll("g[data-f]").forEach(function (x) { x.style.display = x === g ? "" : "none"; });
    el._cur = name;
  }
  function frameAt(a, t) {
    var seq = ANIM[a], tot = 0, i; for (i = 0; i < seq.length; i++) tot += seq[i][1];
    var m = t % tot; for (i = 0; i < seq.length; i++) { if (m < seq[i][1]) return seq[i][0]; m -= seq[i][1]; }
    return seq[0][0];
  }
  function play(el, a, ms) { el._tmp = a; el._until = performance.now() + ms; }
  Deck.playAvatar = play;

  Deck.px = function (root) {
    (root || document).querySelectorAll("[data-px]").forEach(function (el) {
      if (el.firstElementChild) return;
      if (CH[el.getAttribute("data-px")]) renderChar(el); else el.innerHTML = svg(el.getAttribute("data-px"));
    });
  };
  var orig = Deck.slide;
  Deck.slide = function (id, fn) { return orig.call(Deck, id, function (el, tl, h) { Deck.px(el); return fn(el, tl, h); }); };

  if (LIVE) setInterval(function () {
    var now = performance.now();
    document.querySelectorAll(CHSEL).forEach(function (el, i) {
      var a = el._until && now < el._until ? el._tmp : el.getAttribute("data-anim") || "idle";
      if (!ANIM[a]) a = "idle";
      setFrame(el, frameAt(a, now + i * 700));
    });
  }, 50);

  /* ---------- sonidos 8-bit (Web Audio, sin archivos) ---------- */
  var AC = null, UNLOCKED = false, MUTED = false;
  try { MUTED = localStorage.getItem("tp-mute") === "1"; } catch (e) {}
  function ctx() {
    if (!AC) { try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return null; } }
    if (AC.state === "suspended") AC.resume();
    return AC;
  }
  function tone(f, at, dur, type, vol, f2) {
    var a = AC, o = a.createOscillator(), g = a.createGain(), t = a.currentTime + at;
    o.type = type || "square"; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(vol || 0.05, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(at, dur, vol) {
    var a = AC, n = Math.floor(a.sampleRate * dur), b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0), seed = 7;
    for (var i = 0; i < n; i++) { seed = (seed * 16807) % 2147483647; d[i] = (seed / 2147483647) * 2 - 1; }
    var s = a.createBufferSource(), g = a.createGain(), t = a.currentTime + at;
    s.buffer = b; g.gain.setValueAtTime(vol || 0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(g); g.connect(a.destination); s.start(t);
  }
  var SFX = {
    blip: function () { tone(660, 0, 0.05, "square", 0.025, 880); },
    back: function () { tone(520, 0, 0.05, "square", 0.025, 390); },
    select: function () { tone(523, 0, 0.05, "square", 0.04); tone(784, 0.05, 0.07, "square", 0.04); },
    door: function () { noise(0, 0.12, 0.05); tone(196, 0.02, 0.22, "triangle", 0.12, 98); tone(523, 0.22, 0.08, "square", 0.04); tone(784, 0.3, 0.12, "square", 0.04); },
    coin: function () { tone(988, 0, 0.08, "square", 0.05); tone(1319, 0.08, 0.3, "square", 0.05); },
    power: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, i * 0.06, 0.09, "square", 0.04); }); },
    fly: function () { noise(0, 0.6, 0.03); tone(300, 0, 0.6, "triangle", 0.05, 900); },
    throw: function () { tone(400, 0, 0.25, "triangle", 0.07, 1200); },
    hit: function () { noise(0, 0.18, 0.12); tone(160, 0, 0.2, "square", 0.08, 50); },
    defeat: function () { [784, 659, 523, 392, 262].forEach(function (f, i) { tone(f, i * 0.07, 0.1, "square", 0.04); }); },
    hola: function () { tone(660, 0, 0.07, "triangle", 0.08); tone(880, 0.08, 0.1, "triangle", 0.08); },
    start: function () { [523, 659, 784, 1047, 784, 1047].forEach(function (f, i) { tone(f, i * 0.09, 0.12, "square", 0.04); }); },
    jump: function () { tone(330, 0, 0.16, "square", 0.04, 880); },
    creak: function () { [150, 128, 160, 120, 140].forEach(function (f, i) { tone(f, i * 0.07, 0.09, "sawtooth", 0.035, f * 0.92); }); },
    spooky: function () {
      tone(110, 0, 1.4, "sawtooth", 0.035, 98); tone(116.5, 0, 1.4, "sawtooth", 0.03, 103);
      [466, 440, 415, 392, 311].forEach(function (f, i) { tone(f, 0.15 + i * 0.16, 0.22, "triangle", 0.06); });
      noise(0, 0.5, 0.025);
    },
    portal: function () { noise(0, 0.5, 0.04); tone(180, 0, 0.55, "sine", 0.09, 1400); },
    reveal: function () { [392, 523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.11, 0.18, "triangle", 0.07); }); },
  };
  Deck.sfx = function (name, tl) {
    if (MUTED || !AUDIENCE || !UNLOCKED || !SFX[name]) return;
    if (tl && tl.paused && tl.paused()) return;           // al saltar hacia atrás no suena
    if (!ctx()) return;
    try { SFX[name](); } catch (e) {}
  };
  function unlock() { UNLOCKED = true; ctx(); }
  function setMute(m) {
    MUTED = m; try { localStorage.setItem("tp-mute", m ? "1" : "0"); } catch (e) {}
    var b = document.querySelector("#footer .snd"); if (b) b.textContent = m ? "♪ off" : "♪ on";
  }

  /* ---------- interacción ---------- */
  function stageScale(el) { var s = el.closest(".slide") || document.getElementById("stage"); return s.getBoundingClientRect().width / 1920; }
  function say(el, text) {
    var slide = el.closest(".slide"); if (!slide) return;
    var sr = slide.getBoundingClientRect(), r = el.getBoundingClientRect(), k = sr.width / 1920;
    var b = document.createElement("div"); b.className = "say"; b.textContent = text;
    b.style.left = ((r.left + r.width / 2 - sr.left) / k) + "px"; b.style.top = ((r.top - sr.top) / k - 14) + "px";
    slide.appendChild(b);
    gsap.fromTo(b, { scale: 0, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.25, ease: "back.out(3)" });
    gsap.to(b, { opacity: 0, y: -16, duration: 0.3, delay: 1.5, onComplete: function () { b.remove(); } });
  }
  var busy = false;
  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", function (e) {
    unlock();
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var t = e.target; if (t && (t.isContentEditable || /INPUT|TEXTAREA/.test(t.tagName))) return;
    if (e.key === "s" || e.key === "S") { setMute(!MUTED); return; }
    if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") Deck.sfx("blip");
    else if (e.key === "ArrowLeft" || e.key === "PageUp") Deck.sfx("back");
  }, true);

  document.addEventListener("pointerover", function (e) {
    var d = e.target.closest && e.target.closest(".door, .c3-opt, .c16-q, .px-btn[data-next]");
    if (d && !d.contains(e.relatedTarget)) Deck.sfx("select");
  });

  document.addEventListener("click", function (e) {
    var t = e.target; if (!t.closest) return;
    /* botón "pulsa para empezar" */
    var nx = t.closest("[data-next]");
    if (nx) { e.stopPropagation(); Deck.sfx("start"); var i = Deck.indexOfSlide(nx.closest(".slide")); setTimeout(function () { Deck.go(i + 1); }, LIVE ? 500 : 0); return; }
    /* puertas: se abre, asoman unos ojos, tiembla todo, Jorge entra y el portal se traga la pantalla */
    var b = t.closest("[data-go]");
    if (b) {
      e.stopPropagation(); if (busy) return;
      var target = document.getElementById(b.getAttribute("data-go")); if (!target) return;
      var idx = Deck.indexOfSlide(target), slide = b.closest(".slide"), me = slide && slide.querySelector('.frame [data-px="jorge"]');
      if (!(idx >= 0)) { var nx2 = target.nextElementSibling; while (nx2 && !(Deck.indexOfSlide(nx2) >= 0)) nx2 = nx2.nextElementSibling; if (!nx2) return; idx = Deck.indexOfSlide(nx2); }
      if (!LIVE) { Deck.go(idx); return; }
      busy = true;
      var leaf = b.querySelector(".door-leaf"), eyes = b.querySelector(".eyes"), frame = slide.querySelector(".frame"), dv = b.querySelector(".px-door") || b;
      Deck.sfx("creak");
      if (leaf) gsap.to(leaf, { rotationY: -84, transformPerspective: 700, transformOrigin: "0% 50%", duration: 0.5, ease: "power2.out" });
      if (eyes) { gsap.fromTo(eyes, { opacity: 0 }, { opacity: 1, duration: 0.15, delay: 0.35 }); gsap.fromTo(eyes, { scaleY: 1 }, { scaleY: 0.1, duration: 0.07, repeat: 3, yoyo: true, delay: 0.75 }); }
      setTimeout(function () { Deck.sfx("spooky"); }, 280);
      gsap.fromTo(frame, { x: 0 }, { x: 7, duration: 0.05, repeat: 11, yoyo: true, delay: 0.4, onComplete: function () { gsap.set(frame, { x: 0 }); } });
      if (me) {
        var k = stageScale(me), dr = dv.getBoundingClientRect(), mr = me.getBoundingClientRect();
        var dx = ((dr.left + dr.width / 2) - (mr.left + mr.width / 2)) / k, dy = (dr.bottom - mr.bottom) / k;
        play(me, "walk", 900);
        gsap.to(me, { x: dx, y: dy, duration: 0.7, ease: "none", delay: 0.25 });
        gsap.to(me, { opacity: 0, scale: 0.5, duration: 0.15, delay: 0.95 });
      }
      /* el portal: un círculo oscuro con el color del mundo que crece desde la puerta */
      var sr = slide.getBoundingClientRect(), r = dv.getBoundingClientRect(), k2 = sr.width / 1920;
      var cx = ((r.left + r.width / 2 - sr.left) / k2).toFixed(0), cy = ((r.top + r.height * 0.55 - sr.top) / k2).toFixed(0);
      var ov = document.createElement("div"); ov.className = "portal"; ov.style.color = getComputedStyle(b).color;
      ov.innerHTML = '<span class="portal-eyes" data-px="eyes"></span>'; Deck.px(ov); slide.appendChild(ov);
      gsap.set(ov, { clipPath: "circle(0px at " + cx + "px " + cy + "px)" });
      gsap.to(ov, { clipPath: "circle(2300px at " + cx + "px " + cy + "px)", duration: 0.6, ease: "power3.in", delay: 1.05, onStart: function () { Deck.sfx("portal"); } });
      gsap.fromTo(ov.firstChild, { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.4, delay: 1.35, ease: "back.out(2)" });
      setTimeout(function () {
        Deck.go(idx);
        setTimeout(function () {
          busy = false; ov.remove();
          if (leaf) gsap.set(leaf, { clearProps: "transform" });
          if (eyes) gsap.set(eyes, { clearProps: "opacity,transform" });
          if (me) gsap.set(me, { x: 0, y: 0, opacity: 1, scale: 1 });
        }, 700);
      }, 1800);
      return;
    }
    /* clic en Jorge: saluda */
    var me2 = t.closest('[data-px="jorge"], [data-px="invitado"]');
    if (me2) { e.stopPropagation(); play(me2, "wave", 1600); Deck.sfx("hola"); say(me2, "¡Hola!"); return; }
    /* encuesta: elegir respuesta */
    var opt = t.closest(".c3-opt");
    if (opt) { e.stopPropagation(); opt.parentNode.querySelectorAll(".c3-opt").forEach(function (o) { o.classList.toggle("picked", o === opt); }); Deck.sfx("select"); return; }
    /* misiones: marcar */
    var q = t.closest(".c16-q");
    if (q) {
      e.stopPropagation(); q.classList.toggle("done");
      if (q.classList.contains("done")) { Deck.sfx("coin"); var xp = q.querySelector(".c16-xp"); if (xp) gsap.fromTo(xp, { y: 0, scale: 1 }, { y: -10, scale: 1.25, duration: 0.18, yoyo: true, repeat: 1 }); }
      return;
    }
    /* jefe: pegarle */
    var boss = t.closest(".c8-boss");
    if (boss) { e.stopPropagation(); Deck.sfx("hit"); gsap.fromTo(boss, { x: -10 }, { x: 0, duration: 0.4, ease: "elastic.out(1,0.3)" }); return; }
    /* cualquier otro clic en la slide avanza: blip */
    if (t.closest(".slide") && !t.closest("a,button,video,[data-noclick]")) Deck.sfx("blip");
  });

  /* ---------- barra de abajo: mapa del juego ---------- */
  function buildTrack() {
    var f = document.getElementById("footer"); if (!f || f.querySelector(".trk") || !(Deck._files && Deck._files.length)) return;
    var files = Deck._files || [];
    var trk = document.createElement("div"); trk.className = "trk";
    var cells = files.map(function (file) {
      var sl = document.querySelector('section.slide[data-file="' + file + '"]'), sec = sl ? +sl.dataset.section || 0 : 0;
      var c = document.createElement("i");
      c.style.setProperty("--c", sec === 1 ? "#6366f1" : sec === 2 ? "#f59e0b" : sec === 3 ? "#10b981" : "#7fb4f5");
      if (sl && sl.id.indexOf("hub") > -1) c.className = "hub";
      trk.appendChild(c); return c;
    });
    var mini = document.createElement("span"); mini.className = "mini"; mini.setAttribute("data-px", "jorge"); mini.setAttribute("data-anim", "idle");
    trk.appendChild(mini); Deck.px(trk);
    var snd = document.createElement("button"); snd.className = "snd"; snd.type = "button"; snd.textContent = MUTED ? "♪ off" : "♪ on";
    snd.addEventListener("click", function (e) { e.stopPropagation(); unlock(); setMute(!MUTED); if (!MUTED) Deck.sfx("select"); });
    var fsec = f.querySelector(".fsec");
    f.insertBefore(trk, fsec ? fsec.nextSibling : null);
    f.insertBefore(snd, f.querySelector(".flogos"));
    var fnum = f.querySelector(".fnum"); if (fnum) fnum.setAttribute("data-total", files.length);
    var last = -1;
    function update() {
      var n = parseInt(fnum && fnum.textContent, 10); if (!(n > 0)) return; var i = n - 1;
      cells.forEach(function (c, j) { c.classList.toggle("done", j < i); c.classList.toggle("cur", j === i); });
      var c = cells[i]; if (!c) return;
      var x = c.offsetLeft + c.offsetWidth / 2 - mini.offsetWidth / 2;
      if (!LIVE || last < 0) gsap.set(mini, { x: x });
      else { play(mini, "walk", 650); gsap.to(mini, { x: x, duration: 0.6, ease: "none" }); }
      last = i;
    }
    if (fnum) new MutationObserver(update).observe(fnum, { childList: true, characterData: true, subtree: true });
    update(); setTimeout(update, 400);
  }
  document.addEventListener("DOMContentLoaded", function () {
    Deck.px(document);
    var tries = 0, iv = setInterval(function () {   // el motor rellena Deck._files al arrancar (tras cargar fuentes)
      if ((Deck._files && Deck._files.length) || ++tries > 100) { clearInterval(iv); if (Deck._files && Deck._files.length) buildTrack(); }
    }, 50);
  });
})();
