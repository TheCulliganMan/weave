import {useBranchPointFromURIString} from '../../PagePanelComponents/hooks';
import {uriFromNode, determineURISource} from '../../PagePanelComponents/util';
import {ChildPanelFullConfig} from '../ChildPanel';

export const useEntityAndProject = (config: ChildPanelFullConfig) => {
  const inputNode = config.input_node;
  const maybeURI = uriFromNode(inputNode);
  const branchPoint = useBranchPointFromURIString(maybeURI);
  const entityProjectName = determineURISource(maybeURI, branchPoint);

  return {
    entityName: entityProjectName?.entity ?? '',
    projectName: entityProjectName?.project ?? '',
  };
};
