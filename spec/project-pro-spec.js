/**
 * @file Package specs (CommonJS). Run from Pulsar:
 *       View > Developer > Run Package Specs
 */

const ProjectStore = require('../lib/project-store');

describe('ProjectPro store', () => {
  let store;

  beforeEach(() => {
    store = new ProjectStore();
  });

  it('adds and removes projects', () => {
    store.addProject('/tmp/demo-project');
    expect(store.count()).toBe(1);
    store.removeProject('/tmp/demo-project');
    expect(store.count()).toBe(0);
  });

  it('does not add duplicates', () => {
    store.addProject('/tmp/demo-project');
    store.addProject('/tmp/demo-project');
    expect(store.count()).toBe(1);
  });

  it('filters projects by name or path', () => {
    store.addProject('/tmp/alpha');
    store.addProject('/tmp/beta');
    expect(store.getFiltered('alp').length).toBe(1);
    expect(store.getFiltered('').length).toBe(2);
  });
});
