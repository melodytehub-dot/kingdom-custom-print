// Next's cache helpers need a request store that does not exist in the QA
// process, so they become no-ops. The QA database is read directly.
export function revalidatePath() {}
export function revalidateTag() {}
export function unstable_noStore() {}
export function unstable_cache(fn) {
  return fn;
}
