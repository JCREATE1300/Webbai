<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep whole-model byte tracking in `electron/model-progress.cjs` and include it in desktop packaging; manifest layer sizes provide a reliable denominator before sequential downloads start.
- Treat Ollama pull errors or streams without a success event as failed downloads; only select a model after verified completion.
- Keep public Ollama library and exact tag parsing in `electron/model-library.cjs`, included in desktop packaging; list live families without a curated cap and fetch versions on demand.

- Store account-free conversations in browser/device storage; never expose existing private account records.
- Share desktop update state through a root provider and keep updater IPC in electron/updater.cjs, included in packaging, so the download button and notification stay synchronized.
- Resolve Windows downloads from public GitHub release assets, preferring the standalone EXE and supporting ZIP-only releases; do not sign private storage downloads for anonymous visitors.
