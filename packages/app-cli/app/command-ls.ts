import BaseCommand from './base-command';
import app from './app';
import { _ } from '@joplin/lib/locale';
import BaseModel from '@joplin/lib/BaseModel';
import Folder from '@joplin/lib/models/Folder';
import Setting from '@joplin/lib/models/Setting';
import Note from '@joplin/lib/models/Note';
const { sprintf } = require('sprintf-js');
import time from '@joplin/lib/time';
const { cliUtils } = require('./cli-utils.js');

class Command extends BaseCommand {
	public override usage() {
		return 'ls [note-pattern]';
	}

	public override description() {
		return _('Displays the notes in the current notebook. Use `ls /` to display the list of notebooks.');
	}

	public override enabled() {
		return true;
	}

	public override options() {
		return [
			['-n, --limit <num>', _('Displays only the first top <num> notes.')],
			['-s, --sort <field>', _('Sorts the item by <field> (eg. title, updated_time, created_time).')],
			['-r, --reverse', _('Reverses the sorting order.')],
			['-t, --type <type>', _('Displays only the items of the specific type(s). Can be `n` for notes, `t` for to-dos, or `nt` for notes and to-dos (eg. `-tt` would display only the to-dos, while `-tnt` would display notes and to-dos.')],
			['-f, --format <format>', _('Either "text" or "json"')],
			['-l, --long', _('Use long list format. Format is ID, NOTE_COUNT (for notebook), DATE, TODO_CHECKED (for to-dos), TITLE')],
		];
	}

	public override async action(args: any) {
		const pattern = args['note-pattern'];
		let items = [];
		const options = args.options;

		const queryOptions: any = {};
		if (options.limit) queryOptions.limit = options.limit;
		if (options.sort) {
			queryOptions.orderBy = options.sort;
			queryOptions.orderByDir = 'ASC';
		}
		if (options.reverse === true) queryOptions.orderByDir = queryOptions.orderByDir === 'ASC' ? 'DESC' : 'ASC';
		queryOptions.caseInsensitive = true;
		if (options.type) {
			queryOptions.itemTypes = [];
			if (options.type.indexOf('n') >= 0) queryOptions.itemTypes.push('note');
			if (options.type.indexOf('t') >= 0) queryOptions.itemTypes.push('todo');
		}
		if (pattern) queryOptions.titlePattern = pattern;
		queryOptions.uncompletedTodosOnTop = Setting.value('uncompletedTodosOnTop');

		let modelType = null;
		if (pattern === '/' || !app().currentFolder()) {
			queryOptions.includeConflictFolder = true;
			items = await Folder.all(queryOptions);
			modelType = Folder.modelType();
		} else {
			if (!app().currentFolder()) throw new Error(_('Please select a notebook first.'));
			items = await Note.previews(app().currentFolder().id, queryOptions);
			modelType = Note.modelType();
		}

		if (options.format && options.format === 'json') {
			this.stdout(JSON.stringify(items));
		} else {
			let hasTodos = false;
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				if (item.is_todo) {
					hasTodos = true;
					break;
				}
			}

			const seenTitles = [];
			const rows = [];
			let shortIdShown = false;
			for (let i = 0; i < items.length; i++) {
				const item = items[i];
				const row = [];

				if (options.long) {
					row.push(BaseModel.shortId(item.id));
					shortIdShown = true;

					if (modelType === Folder.modelType()) {
						row.push(await Folder.noteCount(item.id));
					}

					row.push(time.formatMsToLocal(item.user_updated_time));
				}

				let title = item.title;
				if (!shortIdShown && (seenTitles.indexOf(item.title) >= 0 || !item.title)) {
					title += ` (${BaseModel.shortId(item.id)})`;
				} else {
					seenTitles.push(item.title);
				}

				if (hasTodos) {
					if (item.is_todo) {
						row.push(sprintf('[%s]', item.todo_completed ? 'X' : ' '));
					} else {
						row.push('   ');
					}
				}

				row.push(title);

				rows.push(row);
			}

			cliUtils.printArray(this.stdout.bind(this), rows);
		}
	}
}

module.exports = Command;
