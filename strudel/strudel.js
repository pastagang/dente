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

// hmm but this breaks flok compatibility..
// maybe it's not hard enough
globalThis.canvas = parent.document.body.querySelector("#canvas");

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
    // why do we need to await this stuff here? i have no clue
    // this.core = await import("@strudel/core");
    // this.mini = await import("@strudel/mini");
    // this.webaudio = await import("@strudel/webaudio");
    // this.draw = await import("@strudel/draw");
    // this.midi = await import("@strudel/midi");

    // NEW IMPORTS: using esm.sh
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
    try {
      await Promise.all([
        this.loadSamples(),
        registerSynthSounds(),
        // registerSoundfonts(),
      ]);
      //   this.printSounds();
    } catch (err) {
      //   this.onError(err);
    }
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
    setTime(() => this.scheduler?.now()); // this is cursed

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

  static noSamplesInjection = `
	  function sample(a) { throw Error('no samples today'); };
	  function samples(a) { throw Error('no samples today'); };
	  function speechda(){ throw Error('no samples today'); };
	  function hubda(){ throw Error('no samples today'); };
	  function spagda(){ throw Error('no samples today'); };
	`;

  // static syncedCpmInjection = ``;

  // TODO: make this apply to all panes, not just the current one
  // TODO: make this somehow not compete with other flok clients
  // static syncedCpmInjection = `
  //   function setCpm(cpm) {
  //     const f = (120/4/cpm);
  //     console.log(f)
  //     all(x=>x.slow(f));
  //   }
  //   function setCps(cps) {
  //     const f = (0.5/cps);
  //     all(x=>x.slow(f));
  //   }
  //   function setcpm(cpm) { setCpm(cpm); }
  //   function setcps(cps) { setCps(cps); }
  // `;

  async eval(msg, conversational = false) {
    const { body: code, docId } = msg;

    let injection = "";
    // if (window.parent.getWeather().noSamples) {
    //   injection += StrudelSession.noSamplesInjection;
    // }

    // injection += StrudelSession.syncedCpmInjection;
    injection += `\nsilence;`;

    try {
      !conversational && this.hush();
      // little hack that injects the docId at the end of the code to make it available in afterEval
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
    } catch (err) {
      console.error(err);
      //   this.onError(`${err}`, docId);
    }
  }
}

// const { highlightMiniLocations, updateMiniLocations, editorViews } = window.parent;
// const { getSyncOffset } = window.parent;
// window.getSyncOffset = getSyncOffset;
// this is expected to run in an iframe
// this way, strudel runs in an iframe
// so it wont mess with the global scope
// + we can sandbox the evaluation
// the js here is only for plumbing postMessages
// + creating the strudel session
// import { StrudelSession } from '/src/strudel-panel.js';
function send(type, msg) {
  window.parent.postMessage({ type, msg });
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
console.log("[strudel] waiting for document click to init");
window.parent.document.addEventListener("click", async function interaction() {
  window.parent.document.removeEventListener("click", interaction);
  await strudel.initAudio();
  console.log("[strudel] audio init done");
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
