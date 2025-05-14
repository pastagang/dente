import {
  controls,
  evalScope,
  stack,
  evaluate,
  silence,
  getTrigger,
  setTime,
  register,
  Pattern,
  fast,
  Cyclist,
  // @ts-ignore
} from "https://esm.sh/@strudel/core@1.2.0";
// @ts-ignore
// import { registerSoundfonts } from "https://esm.sh/@strudel/soundfonts@1.2.1";
// @ts-ignore
import { transpiler } from "https://esm.sh/@strudel/transpiler@1.2.0";
import {
  aliasBank,
  getAudioContext,
  initAudio,
  registerSynthSounds,
  samples,
  webaudioOutput,
  // @ts-ignore
} from "https://esm.sh/@strudel/webaudio@1.2.1";

controls.createParam("docId");

export class StrudelSession {
  cps = 0.5;
  constructor() {
    this.patterns = {};
    this.pPatterns = {};
    // this.allTransform = undefined;
    this.anonymousIndex = 0;
    // this.onError = onError;
    // this.onHighlight = onHighlight;
    // this.onUpdateMiniLocations = onUpdateMiniLocations;
    // this.enableAutoAnalyze = true;
    this.init();
  }

  async loadSamples() {
    const ds =
      "https://raw.githubusercontent.com/felixroos/dough-samples/main/";
    const ts = "https://raw.githubusercontent.com/todepond/samples/main/";
    await Promise.all([
      samples(`${ds}/tidal-drum-machines.json`),
      samples(`${ds}/piano.json`),
      samples(`${ds}/Dirt-Samples.json`),
      samples(`${ds}/EmuSP12.json`),
      samples(`${ds}/vcsl.json`),
    ]);
    aliasBank(`${ts}/tidal-drum-machines-alias.json`);
  }

  async init() {
    // @ts-ignore
    this.core = await import("https://esm.sh/@strudel/core@1.2.0");
    // @ts-ignore
    this.mini = await import("https://esm.sh/@strudel/mini@1.2.0");
    // @ts-ignore
    this.webaudio = await import("https://esm.sh/@strudel/webaudio@1.2.1");
    // @ts-ignore
    this.draw = await import("https://esm.sh/@strudel/draw@1.2.0");
    // @ts-ignore
    this.midi = await import("https://esm.sh/@strudel/midi@1.2.0");
    // @ts-ignore
    this.tonal = import("https://esm.sh/@strudel/tonal@1.2.0");
    // @ts-ignore
    // this.soundfonts = import("https://esm.sh/@strudel/soundfonts@1.2.1");

    await evalScope(
      this.core,
      this.mini,
      this.webaudio,
      this.draw,
      this.tonal,
      // this.soundfonts,
      this.midi,
      controls
    );
    await Promise.all([
      this.loadSamples(),
      registerSynthSounds(),
      // registerSoundfonts(),
    ]);

    const getTime = () => {
      const time = getAudioContext().currentTime;
      // console.log(time);
      return time;
    };
    this.scheduler = new Cyclist({
      onTrigger: getTrigger({ defaultOutput: webaudioOutput, getTime }),
      getTime,
      setInterval,
      clearInterval,
    });
    setTime(() => this.scheduler?.now());

    this.injectPatternMethods();
    this.initHighlighting();
  }
  initAudio() {
    return initAudio();
  }

  initHighlighting() {}

  hush() {
    this.pPatterns = {};
    this.anonymousIndex = 0;
    this.allTransform = undefined;
    return silence;
  }

  // set pattern methods that use this repl via closure
  injectPatternMethods() {
    const self = this;
    Pattern.prototype["p"] = function (id) {
      // allows muting a pattern x with x_ or _x
      if (typeof id === "string" && (id.startsWith("_") || id.endsWith("_"))) {
        // makes sure we dont hit the warning that no pattern was returned:
        self.pPatterns[id] = silence;
        return silence;
      }
      if (id === "$") {
        // allows adding anonymous patterns with $:
        id = `$${self.anonymousIndex}`;
        self.anonymousIndex++;
      }
      self.pPatterns[id] = this;
      return this;
    };
    Pattern.prototype["q"] = function () {
      return silence;
    };
    const all = (transform) => {
      this.allTransform = transform;
      return silence;
    };

    return evalScope({
      // cpm,
      all,
      hush: () => this.hush(),
      //   setCps,
      //   setcps: setCps,
      //   setCpm,
      //   setcpm: setCpm,
    });
  }

  async setDocPattern(docId, pattern) {
    this.patterns[docId] = pattern.docId(docId); // docId is needed for highlighting
    //console.log("this.patterns", this.patterns);
    // this is cps with phase jump on purpose
    // to preserve sync
    const cpsFactor = this.cps * 2; // assumes scheduler to be fixed to 0.5cps
    const allPatterns = fast(cpsFactor, stack(...Object.values(this.patterns)));
    await this.scheduler?.setPattern(allPatterns, true);
  }

  async eval(msg, conversational = false) {
    const { body: code, docId } = msg;

    let injection = "";
    injection += `\nsilence;`;

    try {
      !conversational && this.hush();
      let { pattern, meta, mode } = await evaluate(
        code + injection,
        transpiler
        // { id: '?' }
      );

      //   this.onUpdateMiniLocations(docId, meta?.miniLocations || []);

      // let pattern = silence;
      if (Object.keys(this.pPatterns).length) {
        let patterns = Object.values(this.pPatterns);
        pattern = stack(...patterns);
      }
      if (!pattern?._Pattern) {
        console.warn(
          `[strudel] no pattern found in doc ${docId}. falling back to silence. (you always need to use $: in nudel)`
        );
        pattern = silence;
      }
      if (this.allTransform) {
        pattern = this.allTransform(pattern);
      }

      // fft wiring
      //   if (this.enableAutoAnalyze) {
      //     pattern = pattern.fmap((value) => {
      //       if (typeof value === "object" && value.analyze == undefined) {
      //         value.analyze = "flok-master";
      //       }
      //       return value;
      //     });
      //   }

      if (!pattern) {
        return;
      }
      //console.log("evaluated patterns", this.pPatterns);
      await this.setDocPattern(docId, pattern);

      //console.log("afterEval", meta);
    } catch (error) {
      console.error(error);
      send({ type: "error", msg: error, docId });
    }
  }
}

function send(stuff) {
  window.parent.postMessage(stuff);
}

const strudel = new StrudelSession();
// {
// onError: (...args) => send('onError', args),
// onHighlight: (docId, phase, haps) => highlightMiniLocations(editorViews.get(docId), phase, haps),
// onUpdateMiniLocations: (docId, miniLocations) => updateMiniLocations(editorViews.get(docId), miniLocations),
// }

// window.parent.strudel = strudel;
// window.parent.strudelWindow = window;
// window.parent.sounds = () => strudel.printSounds();
window.parent.document.addEventListener("click", async function interaction() {
  window.parent.document.removeEventListener("click", interaction);
  await strudel.initAudio();
});

window.addEventListener("message", (event) => {
  if (event.origin !== window.location.origin) {
    return;
  }

  // console.log("received", event.data);
  if (event.data.type === "eval") {
    strudel.eval(event.data.msg).catch((err) => console.error(err));
  }
});
