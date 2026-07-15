"use client";

export default function DeleteButton({
  action,
  id,
  confirmMessage,
}: {
  action: (formData: FormData) => void;
  id: string;
  confirmMessage: string;
}) {
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (!confirm(confirmMessage)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button type="submit" className="text-sm text-red-600 hover:underline">
        Verwijderen
      </button>
    </form>
  );
}
