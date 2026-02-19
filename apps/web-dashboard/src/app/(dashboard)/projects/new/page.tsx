import { CreateProjectForm } from "@/components/CreateProjectForm";

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-6 text-2xl font-semibold">New Project</h1>
      <CreateProjectForm />
    </div>
  );
}
