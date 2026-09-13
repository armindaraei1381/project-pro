'use babel';

import ProjectProView from './project-pro-view';
import { CompositeDisposable } from 'atom';

export default {

  projectProView: null,
  modalPanel: null,
  subscriptions: null,

  activate(state) {
    this.projectProView = new ProjectProView(state.projectProViewState);
    this.modalPanel = atom.workspace.addModalPanel({
      item: this.projectProView.getElement(),
      visible: false
    });

    // Events subscribed to in atom's system can be easily cleaned up with a CompositeDisposable
    this.subscriptions = new CompositeDisposable();

    // Register command that toggles this view
    this.subscriptions.add(atom.commands.add('atom-workspace', {
      'project-pro:toggle': () => this.toggle()
    }));
  },

  deactivate() {
    this.modalPanel.destroy();
    this.subscriptions.dispose();
    this.projectProView.destroy();
  },

  serialize() {
    return {
      projectProViewState: this.projectProView.serialize()
    };
  },

  toggle() {
    console.log('ProjectPro was toggled!');
    return (
      this.modalPanel.isVisible() ?
      this.modalPanel.hide() :
      this.modalPanel.show()
    );
  }

};
