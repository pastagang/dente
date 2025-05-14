// @ts-ignore
import { Session } from "https://esm.sh/@flok-editor/session@1.3.0";

//============//
// SETUP FLOK //
//============//
const session = new Session("pastagang5", {
  hostname: "flok.cc",
  isSecure: true,
});

session.on("eval", (msg) => flashEditor(msg.docId));
session.on("change", (flokDocs) => updateEditors(flokDocs));
session.on("eval:js", (msg) => new Function(msg.body)());

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
if (!strudelIframe) throw new Error("Strudel iframe not found");

session.on("eval:strudel", (msg) => {
  strudelIframe.contentWindow?.postMessage({ type: "eval", msg });
});

window.addEventListener("message", (event) => {
  if (event.data.type === "error") {
    const docId = event.data.docId;
    const editor = currentEditors.get(docId);
    if (!editor) throw new Error("Editor not found");
    const element = editor.element;
    console.log(element);
    element.setCustomValidity(event.data.msg);
    element.reportValidity();
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
  if (!editor) throw new Error("Editor not found");
  const element = editor.element;
  element.classList.remove("flash");
  requestAnimationFrame(() => {
    element.classList.add("flash");
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
  if (!editor) throw new Error("Editor not found");

  session._yText(editorId).unobserve(editor.observer);
  editor.element.remove();
  currentEditors.delete(editorId);
}

/**
 * Create an editor, along with everything else it needs.
 */
function createEditor(flokDoc) {
  const currentEditor = currentEditors.get(flokDoc.id);
  if (currentEditor) throw new Error("Editor already exists");

  const yText = session._yText(flokDoc.id);

  //===== Element =====
  const container = document.createElement("section");
  const targetText = document.createElement("label");
  targetText.setAttribute("for", `editor-${flokDoc.id}`);
  targetText.textContent = flokDoc.target;
  container.append(targetText);
  const element = document.createElement("textarea");
  element.id = `editor-${flokDoc.id}`;
  element.className = "editor";
  element.style.whiteSpace = "pre";
  element.value = flokDoc.getText();
  element.style.resize = "none";
  element.setAttribute("spellcheck", "false");
  container.append(element);

  const main = document.querySelector("main");
  if (!main) throw new Error("Main element not found");
  main.append(container);

  element.addEventListener(
    "beforeinput",
    (_e) => {
      /** @type {InputEvent} */
      // @ts-ignore
      const e = _e;

      const start = Math.min(element.selectionStart, element.selectionEnd);
      const end = Math.max(element.selectionStart, element.selectionEnd);
      const length = end - start;

      // console.log(e.inputType, start, end, length);

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
          alert(
            "Unrecognized input type: " +
              e.inputType +
              "\n Please tell #pastagang you saw this message!"
          );
          throw new Error("Unimplemented input type: " + e.inputType);
        }
      }
    },
    { passive: false }
  );

  element.addEventListener("keydown", (event) => {
    if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey || event.altKey)
    ) {
      event.preventDefault();
      session.evaluate(
        flokDoc.id,
        flokDoc.target,
        element.value,
        {
          from: 0,
          to: element.value.length,
        },
        "web"
      );
    }
  });

  //===== Observer =====
  function observer(textEvent, transaction) {
    // Ignore local changes
    if (!transaction.origin) return;

    // Figure out what the changes do
    const changes = textEvent.changes;
    let retainCount = 0;
    let insertCount = 0;
    let deleteCount = 0;
    for (const operation of changes.delta) {
      if (operation.retain) {
        if (retainCount) throw new Error("Unexpected double retain");
        retainCount += operation.retain;
      }
      if (operation.insert) {
        if (insertCount) throw new Error("Unexpected double insert");
        insertCount += operation.insert.length;
      }
      if (operation.delete) {
        if (deleteCount) throw new Error("Unexpected double delete");
        deleteCount += operation.delete;
      }
    }

    // Figure out where the new selection should go
    let selectionStart = Math.min(element.selectionStart, element.selectionEnd);
    let selectionEnd = Math.max(element.selectionStart, element.selectionEnd);
    const backwards = selectionStart > selectionEnd;

    if (selectionStart > retainCount) {
      selectionStart = Math.max(selectionStart - deleteCount, retainCount);
      selectionStart += insertCount;
    }
    if (selectionEnd > retainCount) {
      selectionEnd = Math.max(selectionEnd - deleteCount, retainCount);
      selectionEnd += insertCount;
    }

    // Update the editor
    element.value = flokDoc.getText();
    if (backwards) {
      element.setSelectionRange(selectionEnd, selectionStart);
    } else {
      element.setSelectionRange(selectionStart, selectionEnd);
    }
  }

  session._yText(flokDoc.id).observe(observer);

  const editor = {
    element,
    observer,
    flokDoc,
  };

  currentEditors.set(flokDoc.id, editor);
  return editor;
}

session.initialize();
