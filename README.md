# dente

hard flok client

## running it locally

Clone the repo.

Install a local file serve. I like using deno's file server.

1. [Install deno](https://docs.deno.com/runtime/getting_started/installation/).

2. Install their file server.

```bash
deno install --allow-read --allow-net --allow-sys --reload --force --global https://deno.land/std/http/file_server.ts
```

3. Run the file server.

```bash
file_server
```

4. Open `localhost:4507`.
