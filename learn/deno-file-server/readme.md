## how to use deno's file server

1. [install deno](https://docs.deno.com/runtime/getting_started/installation/).

2. install their file server by typing this into your terminal:

```bash
deno install --allow-read --allow-net --allow-sys --reload --force --global https://deno.land/std/http/file_server.ts
```

3. run the file server by typing this into your terminal:

```bash
file_server
```

4. Open `localhost:4507` in your browser.
