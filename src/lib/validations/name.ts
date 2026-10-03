/** Person names: letters (any language) and spaces only — no digits or symbols. */
export const NAME_REGEX = /^[\p{L}\p{M}]+(?: [\p{L}\p{M}]+)*$/u;
export const NAME_INVALID_MESSAGE = "Name can only contain letters and spaces";
