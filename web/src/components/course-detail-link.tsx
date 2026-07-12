import { Link, useLocation } from "react-router-dom";

export function CourseDetailLink(props: { name: string; detailUrl: string | null | undefined }) {
  const { pathname } = useLocation();
  if (!props.detailUrl) {
    return <>{props.name}</>;
  }

  return (
    <Link
      className="font-medium underline underline-offset-4"
      to={`${detailParentPath(pathname)}/course-detail?url=${encodeURIComponent(props.detailUrl)}&name=${encodeURIComponent(props.name)}`}
    >
      {props.name}
    </Link>
  );
}

function detailParentPath(pathname: string) {
  if (pathname === "/plan" || pathname === "/query") return pathname;
  return "/preselect";
}
