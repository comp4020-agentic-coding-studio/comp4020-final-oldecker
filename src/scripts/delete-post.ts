// Deleting your own post. Only ever rendered for the post's own author (see
// index.astro's authorId check), so there's nothing to gate here client-side
// --- the server's 403 check is the real guard either way.
// No SSE broadcast on a successful delete: posts are reload-only, same
// decision as creating one (see PROCESS.md) --- so another open tab keeps
// showing this post until it next reloads, which is this app's existing
// reload-only trade-off, not a bug specific to deleting.
document.addEventListener("click", async (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(".delete-post");
  if (!button) return;

  const postId = button.dataset.postId;
  const article = button.closest<HTMLElement>(".post");
  if (!postId || !article) return;

  if (!confirm("delete this post? this can't be undone.")) return;

  button.disabled = true;
  try {
    const res = await fetch(`/api/posts/${postId}/delete`, { method: "POST" });
    if (res.ok) article.remove();
    else button.disabled = false;
  } catch {
    button.disabled = false;
  }
});
