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
