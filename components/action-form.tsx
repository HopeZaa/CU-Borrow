"use client";
import { useFormStatus } from "react-dom";
import { useActionState } from "react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/app/actions";
export function Submit({
  children,
  className = "btn",
  pendingText = "กำลังบันทึก…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className={className} type="submit">
      {pending ? pendingText : children}
    </button>
  );
}
export function ActionForm({
  action,
  children,
  label = "บันทึก",
  className = "",
  buttonClass = "btn",
  confirm,
}: {
  action: (state: ActionState, data: FormData) => Promise<ActionState>;
  children?: React.ReactNode;
  label?: string;
  className?: string;
  buttonClass?: string;
  confirm?: string;
}) {
  const [state, dispatch] = useActionState(action, {});
  const router = useRouter();
  useEffect(() => {
    if (state.redirectTo) {
      router.push(state.redirectTo);
      router.refresh();
    }
  }, [state, router]);
  return (
    <form
      action={dispatch}
      className={className}
      onSubmit={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
    >
      {children}
      <Submit className={buttonClass}>{label}</Submit>
      {state.error && (
        <p className="feedback error" role="alert">
          {state.error}
        </p>
      )}
      {state.success && (
        <p className="feedback success" role="status">
          {state.success}
        </p>
      )}
    </form>
  );
}
export function Hidden({ name, value }: { name: string; value: string }) {
  return <input type="hidden" name={name} value={value} />;
}
