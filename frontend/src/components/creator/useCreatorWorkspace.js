import { useOutletContext } from "react-router-dom";

export function useCreatorWorkspace() {
  return useOutletContext();
}
