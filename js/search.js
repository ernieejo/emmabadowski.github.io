---
---
'use strict';

$('.ui.accordion')
    .accordion()
;

//place for storing global data
const global = {};

// Get the generated search_data.json file so lunr.js can search it locally.
global.data = $.getJSON('/search_data.json');
// JEKYLL CODE - Get the generated list of pdfs that exist so that the program won't generate pdf links that don't resolve.
{% assign pdf_files = site.static_files | where: "pdf", true %}
global.filemap = [{% for pdf in pdf_files %}"{{ pdf.path }}"{% unless forloop.last %},{% endunless %}{% endfor %}];

// Build lunr index when data has loaded
global.data.then(function(loaded_data){
    global.idx = lunr(function(){
        this.ref('path');
        const here = this;
        for (let i in window.store){
            //only index text fields
            if (window.store[i]['type'] === 'text') {
                here.field(window.store[i]['value']);
            }
        }
        $.each(loaded_data, function(index, value){
         here.add($.extend({"path":index},value));
        });
    });
 //after loading index, execute search based on query params
    //get params
    const params = new URLSearchParams(window.location.search);
    let uniqueFields = new Set();
    //get unique fields from params
    for (const key of params.keys() ){
        uniqueFields.add(key);
    }
    generate_param_labels(params, uniqueFields);

    let allResults = []; //array for holding every result from all queries
    let incResults = []; //array for holding results that should be displayed;
    //search logic:
     // - for each unique param entry, perform a search
    uniqueFields.forEach(function(field){
        const prefix = (field === 'q') ? ' ' : ' '+field+':';
        const query = prefix+params.getAll(field).join(prefix);
        //CHANGE THIS replace with a function to use string matching, number matching, or index searching based on field type
        //return a list of all search results.
        const results = execute_query(global.idx, field, query);
        results.forEach(function(result){
            allResults.push(result);
        });
    });

    // if there are params
    if (uniqueFields.size){
        // - create set of only results that appear in all searches
        // - use the following function to get object containing counts of each result.ref item
        const resultFrequency = allResults.reduce(function(obj,b) {
            obj[b] = ++ obj[b] || 1;
            return obj;
        }, {});
        // - compare returned counts against number of query params; only return results that appear as many times as there are params
        for (const key in resultFrequency){
            if (!resultFrequency.hasOwnProperty(key)){continue;}
            if (resultFrequency[key] === uniqueFields.size){
                incResults.push(key);
            }
        }
        // - forward set to display_search_results
        display_search_results(incResults, loaded_data);
    } else { //if there are no params, display everything.
        const results = global.idx.search('');
        results.forEach(function(result){
            incResults.push(result.ref);
        });
        display_search_results(incResults, loaded_data);
    }

});

// Event when the form is submitted
$("#search_form").submit(function(event){
    event.preventDefault();
    let params = new URLSearchParams(window.location.search); //call up existing search params
    const field = $("#search_field").val();  //value of search_field
    //TO DO --- Add some validation and/or auto-trimming here.
    const queries = $("#search_text").val().replace(' OR ',' ').split(' '); // value of search_text, split into separate terms by spaces
    for (const query of queries){
        params.append(field,query); //build query param based on search field value
    }
    window.location.search = params; //pass param to URL, triggering page reload.
});

function display_search_results(results, loaded_data) {

        // Are there any results?
        if (results.length) {
            const $search_results = $("#search_results");
            // Iterate over the results, building a table row for each one
            for (const result of results) {
                const item = loaded_data[result];
                let row = '<tr>';
                // Build a snippet of HTML for this result
                for (let i in window.store){
                    const key = window.store[i]['value'];
                    row += `<td>${item[key]}${get_pdf_link(key, item, global.filemap)}</td>`;
                }
                row += '</tr>';
                // Add the row to the collection of results.
                $search_results.append(row);
            }
        } else {
            const $search_window = $("#search_window");
            // If there are no results, let the user know.
            $search_window.html('<p><strong>No search results found</strong></p>');
        }
}

function generate_param_labels(params, uniqueFields){
    const $param_labels = $("#param_labels");
    uniqueFields.forEach(function(field){
        const f = window.store.find(item => item.value === field);
        const prefix = (f) ? f.label+':' : 'All Fields:';
        const query = params.getAll(field).join(' OR ');
        //syntax based on SemanticUI labels
        $param_labels.append(`
        <div class="ui large blue label">${prefix}
            <div class="detail">${query}</div>
            <i class="delete icon" onclick="delete_param('${field}')"></i>
        </div>
        `);
    });
}

function execute_query(index, field, query){
    //needs to return an array of search result song_paths.
    const f = window.store.find(item => item.value === field);
    if (f.type === 'text'){ //perform idx search
        const res = index.search(query).pluck('ref');
        console.log(res);
    } else if (f.type === 'num') { //perform number range search

    } else if (f.type === 'sym') { //perform direct string comparisons

    }

}

//deletes a param when you click the X icon on the label
function delete_param(field){
    const params = new URLSearchParams(window.location.search);
    params.delete(field);
    window.location.search = params;
}

//adds a link to the pdf file to the book and song title fields.
function get_pdf_link(field, data, filemap){
    let path = 'not found'; //arbitrary value that definitely wont be a valid path
    //if displaying a book or song title, put together an appropriate path
    if (field === 'book_title'){
        path = `/pdfs/books/${data.book_path}.pdf`;
    } else if (field === 'song_title'){
        path = path = `/pdfs/songs/${data.book_path}/${data.song_path}.pdf`;
    }
    //if the file exists, provide a link.
    if (filemap.includes(path)){
        return `<a href="${path}"><i class="file pdf outline icon"></i></a>`;
    } else {
        return '';
    }
}

