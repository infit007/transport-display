import DashboardLayout from "@/components/layout/DashboardLayout";

const News = () => {
  return (
    <DashboardLayout>
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">News Feeds</h1>
        <p className="text-muted-foreground">Manage and push news updates to displays.</p>
      </div>
    </DashboardLayout>
  );
};

export default News;


