// @ts-ignore
import { Session } from "https://esm.sh/@flok-editor/session@1.3.0";
// @ts-ignore
import { PASTAGANG_ROOM_NAME } from "https://www.pastagang.cc/pastagang.js";
// @ts-ignore
import { createRelativePositionFromJSON } from "https://esm.sh/yjs@13.5.0";

//================//
// ERROR HANDLING //
//================//
function pleaseTellPastagang(_message, info) {
  const message = `Please tell #pastagang you saw this error message:\n\n${_message}`;
  alert(message);
  console.log(info);
  return Error(message);
}

//============//
// SETUP FLOK //
//============//
const session = new Session(PASTAGANG_ROOM_NAME, {
  hostname: "flok.cc",
  isSecure: true,
});

session.on("eval", (msg) => flashEditor(msg.docId));
session.on("eval:js", (msg) => new Function(msg.body)());
session.on("change", (flokDocs) => updateEditors(flokDocs));
session.initialize();

const awareness = session.awareness;
session.user = "ghost";

//=============//
// SETUP HYDRA //
//=============//
session.on("eval:hydra", (msg) => {
  // TODO
  // console.log("eval:hydra", msg);
});

//===============//
// SETUP STRUDEL //
//===============//
/** @type {HTMLIFrameElement | null} */
const strudelIframe = document.querySelector("#strudel");
if (!strudelIframe) throw pleaseTellPastagang("Strudel iframe not found");

session.on("eval:strudel", (msg) => {
  strudelIframe.contentWindow?.postMessage({ type: "eval", msg });
});

window.addEventListener("message", (event) => {
  if (event.data.type === "error") {
    const docId = event.data.docId;
    const editor = currentEditors.get(docId);
    if (!editor) throw pleaseTellPastagang("Editor not found");
    const textarea = editor.textarea;
    textarea.setCustomValidity(event.data.msg);
    textarea.reportValidity();
  }
});

//==========//
// SETTINGS //
//==========//
let pastingMode = localStorage.getItem("pastingMode") === "true";

//=========//
// EDITORS //
//=========//
const currentEditors = new Map();

/**
 * Flash an editor to indicate an evaluation.
 */
function flashEditor(editorId) {
  const editor = currentEditors.get(editorId);
  if (!editor) throw pleaseTellPastagang("Editor not found");
  const textarea = editor.textarea;
  textarea.setCustomValidity("");
  textarea.reportValidity();
  textarea.classList.remove("flash");
  requestAnimationFrame(() => {
    textarea.classList.add("flash");
  });
}

/**
 * Update the editors on the page to match the current flok panels
 * (deleting if necessary) (creating if necessary)
 */
function updateEditors(flokDocs) {
  for (const [flokDocId] of currentEditors) {
    if (flokDocs.find((v) => v.id === flokDocId)) continue;
    deleteEditor(flokDocId);
  }

  for (const flokDoc of flokDocs) {
    if (currentEditors.has(flokDoc.id)) continue;
    createEditor(flokDoc);
  }
}

/**
 * Delete and clean up an editor.
 */
function deleteEditor(editorId) {
  const editor = currentEditors.get(editorId);
  if (!editor) throw pleaseTellPastagang("Editor not found");

  session._yText(editorId).unobserve(editor.observer);
  editor.section.remove();
  currentEditors.delete(editorId);
}

/**
 * Create an editor, along with everything else it needs.
 */
function createEditor(flokDoc) {
  const currentEditor = currentEditors.get(flokDoc.id);
  if (currentEditor) throw pleaseTellPastagang("Editor already exists");

  const yText = session._yText(flokDoc.id);

  //===== Element =====
  const section = document.createElement("section");
  const targetText = document.createElement("label");
  targetText.setAttribute("for", `editor-${flokDoc.id}`);
  targetText.textContent = flokDoc.target;
  section.append(targetText);
  const textarea = document.createElement("textarea");
  textarea.id = `editor-${flokDoc.id}`;
  textarea.className = "editor";
  textarea.style.whiteSpace = "pre";
  textarea.value = flokDoc.getText();
  textarea.style.resize = "none";
  textarea.setAttribute("spellcheck", "false");
  section.append(textarea);

  const main = document.querySelector("main");
  if (!main) throw pleaseTellPastagang("Main element not found");
  main.append(section);

  //===== Input =====
  const inputHandler = getInputHandler({ textarea, yText });
  textarea.addEventListener("beforeinput", inputHandler, { passive: false });
  textarea.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey || event.altKey)
    ) {
      event.preventDefault();
      session.evaluate(
        flokDoc.id,
        flokDoc.target,
        textarea.value,
        {
          from: 0,
          to: textarea.value.length,
        },
        "web"
      );
    }
  });

  //===== Caret =====
  textarea.addEventListener("selectionchange", () => {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    awareness.setLocalStateField("cursor", {
      hiddenCaret: false,
      anchor: {
        type: null,
        tname: `text:${flokDoc.id}`,
        assoc: 0,
        item: null,
        character: start,
      },
      head: {
        type: null,
        tname: `text:${flokDoc.id}`,
        assoc: 0,
        item: null,
        character: end,
      },
    });
  });

  //===== Observer =====
  const observer = getObserver({ textarea, flokDoc });
  session._yText(flokDoc.id).observe(observer);

  //===== Collecting it all up! =====
  const editor = {
    section,
    textarea,
    observer,
    flokDoc,
  };
  currentEditors.set(flokDoc.id, editor);
  return editor;
}

//===============//
// INPUT HANDLER //
//===============//
function getInputHandler({ textarea, yText }) {
  return function inputHandler(_e) {
    /** @type {InputEvent} */
    // @ts-ignore
    const e = _e;

    const start = Math.min(textarea.selectionStart, textarea.selectionEnd);
    const end = Math.max(textarea.selectionStart, textarea.selectionEnd);
    const length = end - start;

    switch (e.inputType) {
      case "insertText":
      case "insertCompositionText": {
        if (!pastingMode) {
          yText.delete(start, length);
          yText.insert(start, e.data);
        } else {
          e.preventDefault();
          const answer = confirm(
            "Typing is disabled. Do you want to enable typing?"
          );
          if (answer) {
            pastingMode = false;
            localStorage.setItem("pastingMode", "false");
          }
        }
        break;
      }
      case "deleteContent": {
        yText.delete(start, length);
        break;
      }
      case "deleteWordBackward":
      case "deleteContentBackward": {
        if (length) {
          yText.delete(start, length);
        } else {
          yText.delete(start - 1, 1);
        }
        break;
      }
      case "deleteWordForward":
      case "deleteContentForward": {
        if (length) {
          yText.delete(start, length);
        } else {
          yText.delete(start, 1);
        }
        break;
      }
      case "deleteByCut": {
        yText.delete(start, length);
        break;
      }
      case "insertFromPaste": {
        if (!pastingMode) {
          e.preventDefault();
          const answer = confirm(
            "Pasting is disabled. Do you want to enable pasting?"
          );
          if (answer) {
            pastingMode = true;
            localStorage.setItem("pastingMode", "true");
          }
        } else {
          yText.delete(start, length);
          yText.insert(start, e.data);
        }
        break;
      }
      case "insertLineBreak":
      case "insertParagraph": {
        yText.delete(start, length);
        yText.insert(start, "\n");
        break;
      }
      case "historyUndo":
      case "historyRedo": {
        e.preventDefault();
        alert("Undo is disabled.");
        break;
      }

      case "insertByDrop":
      case "deleteByDrag": {
        console.error("Dragging and dropping is disabled.");
        e.preventDefault();
        break;
      }
      default: {
        e.preventDefault();
        throw pleaseTellPastagang("Unimplemented input type: " + e.inputType);
      }
    }
  };
}

//==========//
// OBSERVER //
//==========//
// An observer listens for incoming changes from other people and
// applies them to the textarea in a (hopefully) graceful way.
function getObserver({ textarea, flokDoc }) {
  return function observer(textEvent, transaction) {
    // Ignore local changes
    if (!transaction.origin) return;

    // Get the starting selection
    let selectionStart = Math.min(
      textarea.selectionStart,
      textarea.selectionEnd
    );
    let selectionEnd = Math.max(textarea.selectionStart, textarea.selectionEnd);
    const isSelectionBackwards = selectionStart > selectionEnd;

    // Process the changes
    let retainCount = 0;
    let insertCount = 0;
    let deleteCount = 0;
    for (const operation of textEvent.changes.delta) {
      if (operation.retain) {
        // If we're moving the caret and there's a pending operation,
        // it means we're finished with the pending one, so apply it.
        if (retainCount && isOperationStarted()) {
          applyOperation();
        }
        retainCount += operation.retain;
      }
      if (operation.insert) {
        if (insertCount)
          throw pleaseTellPastagang(
            "Unexpected double insert",
            textEvent.changes
          );
        insertCount += operation.insert.length;
      }
      if (operation.delete) {
        if (deleteCount)
          throw pleaseTellPastagang(
            "Unexpected double delete",
            textEvent.changes
          );
        deleteCount += operation.delete;
      }
    }

    // Apply any pending operations
    if (isOperationStarted()) applyOperation();

    function isOperationStarted() {
      return retainCount > 0 || insertCount > 0 || deleteCount > 0;
    }

    function resetOperation() {
      retainCount = 0;
      insertCount = 0;
      deleteCount = 0;
    }

    function applyOperation() {
      // Find out the new selection
      if (selectionStart > retainCount) {
        selectionStart = Math.max(selectionStart - deleteCount, retainCount);
        selectionStart += insertCount;
      }
      if (selectionEnd > retainCount) {
        selectionEnd = Math.max(selectionEnd - deleteCount, retainCount);
        selectionEnd += insertCount;
      }

      // Update the editor
      textarea.value = flokDoc.getText();
      if (isSelectionBackwards) {
        textarea.setSelectionRange(selectionEnd, selectionStart);
      } else {
        textarea.setSelectionRange(selectionStart, selectionEnd);
      }

      // Reset the operation buffer
      resetOperation();
    }
  };
}
