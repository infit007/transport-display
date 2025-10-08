import DashboardLayout from "@/components/layout/DashboardLayout";

const Schedules = () => {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Schedules</h1>
        <p className="text-muted-foreground">Create and manage playback schedules.</p>
      </div>
    </DashboardLayout>
  );
};

export default Schedules;


