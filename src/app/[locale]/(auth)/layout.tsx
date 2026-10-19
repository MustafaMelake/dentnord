// TODO: auth shell design (logo, split layout).
export default function AuthLayout({ children }: LayoutProps<"/[locale]">) {
  return <div className="flex flex-1 flex-col items-center justify-center">{children}</div>;
}
