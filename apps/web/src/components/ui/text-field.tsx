import { useId, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";

type FieldMessagesProps = {
  hint?: string;
  error?: string;
  hintId: string;
  errorId: string;
};

function FieldMessages({ hint, error, hintId, errorId }: FieldMessagesProps) {
  return (
    <>
      {hint ? (
        <span className="ui-field__message" id={hintId}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span className="ui-field__error" id={errorId} role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}

type FieldProps = {
  label: string;
  hint?: string;
  error?: string;
  fieldSize?: "sm" | "md" | "lg";
  fieldClassName?: string;
};

export type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & FieldProps;

export function TextField({
  id,
  label,
  hint,
  error,
  fieldSize = "md",
  fieldClassName = "",
  required,
  className = "",
  "aria-describedby": describedBy,
  ...inputProps
}: TextFieldProps) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const messageIds = [hint ? hintId : null, error ? errorId : null, describedBy]
    .filter(Boolean)
    .join(" ");
  const controlClasses = [
    "ui-field__control",
    `ui-field__control--${fieldSize}`,
    error ? "ui-field__control--invalid" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
      <div className={`ui-field${fieldClassName ? ` ${fieldClassName}` : ""}`}>
      <label className="ui-field__label" htmlFor={controlId}>
        {label}
        {required ? <span className="ui-field__required" aria-hidden="true">*</span> : null}
      </label>
      <input
        {...inputProps}
        id={controlId}
        className={controlClasses}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageIds || undefined}
      />
      <FieldMessages hint={hint} error={error} hintId={hintId} errorId={errorId} />
    </div>
  );
}

export type TextAreaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & FieldProps;

export function TextAreaField({
  id,
  label,
  hint,
  error,
  fieldSize = "md",
  fieldClassName = "",
  required,
  className = "",
  "aria-describedby": describedBy,
  ...textareaProps
}: TextAreaFieldProps) {
  const generatedId = useId();
  const controlId = id ?? `field-${generatedId}`;
  const hintId = `${controlId}-hint`;
  const errorId = `${controlId}-error`;
  const messageIds = [hint ? hintId : null, error ? errorId : null, describedBy]
    .filter(Boolean)
    .join(" ");
  const controlClasses = [
    "ui-field__control",
    "ui-field__control--textarea",
    `ui-field__control--${fieldSize}`,
    error ? "ui-field__control--invalid" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
      <div className={`ui-field${fieldClassName ? ` ${fieldClassName}` : ""}`}>
      <label className="ui-field__label" htmlFor={controlId}>
        {label}
        {required ? <span className="ui-field__required" aria-hidden="true">*</span> : null}
      </label>
      <textarea
        {...textareaProps}
        id={controlId}
        className={controlClasses}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageIds || undefined}
      />
      <FieldMessages hint={hint} error={error} hintId={hintId} errorId={errorId} />
    </div>
  );
}
