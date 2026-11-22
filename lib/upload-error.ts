export function draftUploadError(error:unknown) {
  const message=error instanceof Error?error.message:'';
  if(/413|payload too large|body.*(size|limit)|request.*too large/i.test(message)) return 'The upload request exceeded the hosting limit. Keep your manuscript and tell the editor the file size so they can help you upload it.';
  return 'The upload could not be confirmed because the connection or upload request failed. Your earlier drafts are safe. Check Work & feedback before retrying, or contact the editor with the file size and time of this attempt.';
}
