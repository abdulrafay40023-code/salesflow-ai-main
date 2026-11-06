import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      className="toaster group"
      style={{ zIndex: 9999999 }}
      closeButton
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-[#0f172a] group-[.toaster]:text-white group-[.toaster]:border-border group-[.toaster]:shadow-2xl font-sans",
          description: "group-[.toast]:text-slate-300",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground font-semibold",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
