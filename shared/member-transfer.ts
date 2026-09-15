const MEMBER_TRANSFER_META_PREFIX = "회원이전메타#";

export function serializeMemberTransferMemo(category: string, adminMemo = ""): string {
  return `${MEMBER_TRANSFER_META_PREFIX}${encodeURIComponent(category)}#${encodeURIComponent(adminMemo)}`;
}

export function parseMemberTransferMemo(value?: string | null): { category: string; adminMemo: string } {
  if (!value?.startsWith(MEMBER_TRANSFER_META_PREFIX)) {
    return { category: "", adminMemo: value || "" };
  }
  const [category = "", adminMemo = ""] = value.slice(MEMBER_TRANSFER_META_PREFIX.length).split("#", 2);
  try {
    return { category: decodeURIComponent(category), adminMemo: decodeURIComponent(adminMemo) };
  } catch {
    return { category: "", adminMemo: "" };
  }
}