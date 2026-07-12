import { Link } from "react-router-dom";

export function CourseDetailLink(props: { name: string; detailUrl: string | null | undefined }) {
  if (!props.detailUrl) {
    return <>{props.name}</>;
  }

  return (
    <Link
      className="font-medium underline underline-offset-4"
      to={`/preselect/course-detail?url=${encodeURIComponent(props.detailUrl)}&name=${encodeURIComponent(props.name)}`}
    >
      {props.name}
    </Link>
  );
}
