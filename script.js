// @ts-ignore
import { Session } from "https://esm.sh/@flok-editor/session@1.3.0";

const session = new Session("pastagang5", {
  hostname: "flok.cc",
  isSecure: true,
});

session.on("change", (...args) => {
  console.log("change", ...args);
});
session.on("eval:hydra", (msg) => {
  console.log("eval:hydra", msg);
});
session.on("eval:strudel", (msg) => {
  console.log("eval:strudel", msg);
});

session.on("sync", () => {
  const flokDocuments = session.getDocuments();
  for (const flokDocument of flokDocuments) {
    createEditorElement(flokDocument);
    session._yText(flokDocument.id).observe((textEvent) => {
      console.log(textEvent.changes);
    });
  }
});

function createEditorElement(doc) {
  const main = document.querySelector("main");
  if (!main) throw new Error("Main element not found");

  const editorElement = document.createElement("textarea");
  editorElement.id = `editor-${doc.id}`;
  editorElement.className = "editor";

  main.append(editorElement);

  return editorElement;
}

session.initialize();
