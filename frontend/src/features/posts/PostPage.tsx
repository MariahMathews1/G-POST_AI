import { Link, useParams } from "react-router";
import PageHeader from "../../components/shared/PageHeader";
import Tabs from "../../components/shared/Tabs";
import PostOverviewTab from "./tabs/PostOverviewTab";
import PostOFGTab from "./tabs/PostOFGTab";
import PostFILTab from "./tabs/PostFILTab";
import PostReviewExportTab from "./tabs/PostReviewExportTab";
export default function PostPage() {
  const { postId } = useParams();
  if (postId !== "demo")
    return (
      <>
        <PageHeader
          title="Post unavailable"
          description="Only the demo Post is available in this UI sprint."
        />
        <Link to="/posts/demo">Open demo Post</Link>
      </>
    );
  return (
    <>
      <Link className="back-link" to="/posts">
        ← Post Builder
      </Link>
      <PageHeader
        title="KLS-1840N FANUC Post"
        description="Machine: KLS-1840N · Controller: FANUC 0i-TF"
        action={<span className="badge">In Development · Demo</span>}
      />
      <Tabs
        label="Post workspace"
        tabs={[
          { label: "Overview", content: <PostOverviewTab /> },
          { label: "OFG Configuration", content: <PostOFGTab /> },
          { label: "FIL / Custom Logic", content: <PostFILTab /> },
          { label: "Review & Export", content: <PostReviewExportTab /> },
        ]}
      />
    </>
  );
}
