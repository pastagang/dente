// @ts-ignore
import { Session } from "https://esm.sh/@flok-editor/session@1.3.0";

const session = new Session("pastagang5", {
  hostname: "flok.cc",
  isSecure: true,
});

session.on("eval", (msg) => {
  flashEditor(msg.docId);
});

session.on("eval:hydra", (msg) => {
  // console.log("eval:hydra", msg);
});
session.on("eval:strudel", (msg) => {
  // console.log("eval:strudel", msg);
});

session.on("sync", () => {});

session.on("change", (flokDocs) => {
  updateDenteEditors(flokDocs);
});

const currentDenteEditors = new Map();
function updateDenteEditors(flokDocs) {
  for (const [flokDocId] of currentDenteEditors) {
    if (flokDocs.find((v) => v.id === flokDocId)) continue;
    deleteDenteEditor(flokDocId);
  }

  for (const flokDoc of flokDocs) {
    if (currentDenteEditors.has(flokDoc.id)) continue;
    createDenteEditor(flokDoc);
  }
}

function deleteDenteEditor(editorId) {
  const editor = currentDenteEditors.get(editorId);
  if (!editor) throw new Error("Editor not found");

  session._yText(editorId).unobserve(editor.observer);

  editor.element.remove();
  currentDenteEditors.delete(editorId);
}

function createDenteEditor(flokDoc) {
  const currentEditor = currentDenteEditors.get(flokDoc.id);
  if (currentEditor) throw new Error("Editor already exists");

  //===== Element =====
  const element = document.createElement("textarea");
  element.id = `editor-${flokDoc.id}`;
  element.className = "editor";
  element.style.whiteSpace = "pre";
  element.value = flokDoc.getText();
  element.style.resize = "none";

  const main = document.querySelector("main");
  if (!main) throw new Error("Main element not found");
  main.append(element);

  element.addEventListener("input", () => {
    session.setTextString(flokDoc.id, element.value);
  });

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
    let selectionStart = element.selectionStart;
    let selectionEnd = element.selectionEnd;
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
    element.setSelectionRange(selectionStart, selectionEnd);
  }

  session._yText(flokDoc.id).observe(observer);

  const denteEditor = {
    element,
    observer,
    flokDoc,
  };

  currentDenteEditors.set(flokDoc.id, denteEditor);
  return denteEditor;
}

function flashEditor(editorId) {
  const editor = currentDenteEditors.get(editorId);
  if (!editor) throw new Error("Editor not found");
  const element = editor.element;
  element.classList.remove("flash-editor");
  requestAnimationFrame(() => {
    element.classList.add("flash-editor");
  });
}

session.initialize();
window["session"] = session;
