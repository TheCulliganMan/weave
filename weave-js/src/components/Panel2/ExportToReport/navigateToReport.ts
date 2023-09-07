import {openInNewTab} from './openInNewTab';

export function makeNameAndID(id: string, name?: string): string {
  // Note we strip base64 = padding to make this pretty.
  // It's added back in parseNameAndID.
  id = id.replace(/=/g, '');
  if (name != null) {
    // Replace all non word characters with dashes, eliminate repeating dashes
    name = name.replace(/\W/g, '-').replace(/-+/g, '-');
  }
  return name != null ? `${encodeURIComponent(name)}--${id}` : id;
}

export function reportViewWithoutPublished(r) {
  return `/${r.entityName}/${r.projectName}/reports/${makeNameAndID(
    r.reportId,
    r.reportName
  )}`;
}
export function reportEdit(r, queryString?: string) {
  const extra = queryString || '';
  return `${reportViewWithoutPublished(r)}/edit${extra}`;
}
export function navigateToReport({
  history,
  entityName,
  projectName,
  reportId,
  reportName,
  draft = true,
  opts,
}) {
  let redirectTo: string;

  const urlParams = {
    entityName,
    projectName,
    reportId,
    reportName,
  };
  redirectTo = reportEdit(urlParams);
  console.log('**urlParams', urlParams, redirectTo);

  // if (opts?.redirectQS != null) {
  //   redirectTo += `?${queryString.stringify(opts.redirectQS)}`;
  // }

  if (opts?.newTab) {
    openInNewTab(history, redirectTo);
  } else {
    history.push(redirectTo);
  }
}
