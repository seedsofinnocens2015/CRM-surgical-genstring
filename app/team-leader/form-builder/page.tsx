import FormBuilderClient from "@/app/components/FormBuilderClient";

export const metadata = {
  title: "Lead Form Builder | Team Leader Portal",
};

export default function TeamLeaderFormBuilderPage() {
  return <FormBuilderClient role="team_leader" />;
}
