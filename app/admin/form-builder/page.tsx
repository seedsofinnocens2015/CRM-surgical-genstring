import FormBuilderClient from "@/app/components/FormBuilderClient";

export const metadata = {
  title: "Lead Form Builder | Admin Portal",
};

export default function AdminFormBuilderPage() {
  return <FormBuilderClient role="admin" />;
}
