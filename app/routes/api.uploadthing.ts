import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { createRouteHandler } from "uploadthing/remix";
import { uploadRouter } from "~/.server/uploadthing";

const handlers = createRouteHandler({ router: uploadRouter });

export const loader = (args: LoaderFunctionArgs) => handlers.loader(args);
export const action = (args: ActionFunctionArgs) => handlers.action(args);
