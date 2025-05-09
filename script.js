// @ts-ignore
import { Session } from "https://esm.sh/@flok-editor/session@1.3.0";

const session = new Session("pastagang5", {
  hostname: "flok.cc",
  isSecure: true,
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
  const editorElement = document.createElement("textarea");
  editorElement.id = `editor-${flokDoc.id}`;
  editorElement.className = "editor";
  editorElement.style.whiteSpace = "pre";
  editorElement.value = flokDoc.getText();
  editorElement.style.resize = "none";

  const main = document.querySelector("main");
  if (!main) throw new Error("Main element not found");
  main.append(editorElement);

  //===== Observer =====
  function observer(textEvent) {
    const changes = textEvent.changes;

    // Figure out what the changes do
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
    let selectionStart = editorElement.selectionStart;
    let selectionEnd = editorElement.selectionEnd;
    if (selectionStart > retainCount) {
      selectionStart = Math.max(selectionStart - deleteCount, retainCount);
      selectionStart += insertCount;
    }
    if (selectionEnd > retainCount) {
      selectionEnd = Math.max(selectionEnd - deleteCount, retainCount);
      selectionEnd += insertCount;
    }

    // Update the editor
    editorElement.value = flokDoc.getText();
    editorElement.setSelectionRange(selectionStart, selectionEnd);
  }

  session._yText(flokDoc.id).observe(observer);

  const denteEditor = {
    element: editorElement,
    observer,
    flokDoc,
  };

  currentDenteEditors.set(flokDoc.id, denteEditor);
  return denteEditor;
}

session.initialize();
window["session"] = session;
