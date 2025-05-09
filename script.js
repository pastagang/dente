// @ts-ignore
import { Session } from "https://esm.sh/@flok-editor/session@1.3.0";

const session = new Session("pastagang5", {
  hostname: "flok.cc",
  isSecure: true,
});

session.on("change", (...args) => {
  // console.log("change", ...args);
});
session.on("eval:hydra", (msg) => {
  // console.log("eval:hydra", msg);
});
session.on("eval:strudel", (msg) => {
  // console.log("eval:strudel", msg);
});

session.on("sync", () => {
  const flokDocuments = session.getDocuments();
  for (const flokDocument of flokDocuments) {
    const editorElement = createEditorElement(flokDocument);
    session._yText(flokDocument.id).observe((textEvent) => {
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
      editorElement.value = flokDocument.getText();
      editorElement.setSelectionRange(selectionStart, selectionEnd);
    });
  }
});

function createEditorElement(doc) {
  const main = document.querySelector("main");
  if (!main) throw new Error("Main element not found");

  const editorElement = document.createElement("textarea");
  editorElement.id = `editor-${doc.id}`;
  editorElement.className = "editor";
  editorElement.style.whiteSpace = "pre";
  editorElement.value = doc.getText();
  editorElement.style.resize = "none";

  main.append(editorElement);
  return editorElement;
}

session.initialize();
window["session"] = session;
