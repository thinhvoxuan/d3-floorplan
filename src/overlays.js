

d3.floorplan.overlays = function () {
    var x = d3.scale.linear(),
        y = d3.scale.linear(),
        name = "overlays",
        canvasCallbacks = [],
        selectCallbacks = [],
        moveCallbacks = [],
        editMode = false,
        line = d3.svg.line()
            .x(function (d) {
                return x(d.x);
            })
            .y(function (d) {
                return y(d.y);
            }),
        dragBehavior = d3.behavior.drag()
            .on("dragstart", __dragItem)
            .on("drag", __mousemove)
            .on("dragend", __mouseup),
        dragged = null;
        moved = false,
        vis = true;

    if (typeof d3.floorplan.overlays.prototype.__id == "undefined") {
        d3.floorplan.overlays.prototype.__id = 0;
    }

    var id = "fp-overlays-"
        + new Date().valueOf()
        + d3.floorplan.overlays.prototype.__id++;

    var me = this;

    var menuOverlay = [
        {
            title: 'Add vertex',
            action: function(elm, d, i) {


                var firstP = d.points[0];
                var lastP = d.points[d.points.length - 1];
                d.points.splice(d.points.length, 0, {
                    x : (firstP.x + lastP.x)/2,
                    y : (firstP.y + lastP.y)/2
                });
                overlays(d3.select(elm.parentNode));
            }
        },
        {
            title: 'Remove vertex',
            action: function(elm, d, i) {
                if(d.points.length <= 3)
                    return alert('Polygon must have at least 3 vertex');
                d.points.pop();
                overlays(d3.select(elm.parentNode));
            }
        },
        {
            title: 'Rename',
            action: function(elm, d, i){
                $('#modalLayerRename #layerNewName').val(d.name);
                $('#modalLayerRename').modal('show');
                $('#modalLayerRename .saveButton').unbind(
                    "click dblclick"
                );
                $('#modalLayerRename .saveButton').click(function(){
                    console.log($('#modalLayerRename #layerNewName').val());
                    d.name = $('#modalLayerRename #layerNewName').val();
                    overlays(d3.select(elm.parentNode));
                });
            }
        },
        {
            title: 'Remove',
            action: function(elm, d, i) {
                var g = d3.select(elm.parentNode);
                g.each(function(data){
                    var arr = data.polygons;
                    for(var i = arr.length; i--;) {
                        if(arr[i].id  === d.id) {
                            arr.splice(i, 1);
                        }
                    }
                });
                overlays(d3.select(elm.parentNode));
            }
        },
        {
            title: 'Show pie chart',
            action: function(elm, d, i) {
                loadPieChart(d);
            }
        }
    ];

    function overlays(g) {
        g.each(function (data) {

            if (!data) return;
            var g = d3.select(this);

            // setup rectangle for capturing events
            var canvas = g.selectAll("rect.overlay-canvas").data([0]);

            canvas.enter().append("rect")
                .attr("class", "overlay-canvas")
                .style("opacity", 0)
                .attr("pointer-events", "all")
                .on("click", function () {
                    if (editMode) {
                        var p = d3.mouse(this);
                            canvasCallbacks.forEach(function (cb) {
                            cb(x.invert(p[0]), y.invert(p[1]));
                        });
                    }
                })
                .on("mouseup.drag", __mouseup)
                .on("touchend.drag", __mouseup);

            canvas.attr("x", x.range()[0])
                .attr("y", y.range()[0])
                .attr("height", y.range()[1] - y.range()[0])
                .attr("width", x.range()[1] - x.range()[0]);

            // draw polygons
            var polygons = g.selectAll("path.polygon")
                .data(data.polygons || [], function (d) {
                    return d.id;
                });

            polygons.enter().append("path")
                .attr("class", "polygon")
                .attr("vector-effect", "non-scaling-stroke")
                .attr("pointer-events", "all")
                .on("mousedown", function (d) {
                    selectCallbacks.forEach(function (cb) {
                        cb(d.id);
                    });
                })
                .on('contextmenu', d3.contextMenu(menuOverlay))
                .call(dragBehavior)
                .append("title");

            polygons.exit().transition().style("opacity", 1e-6).remove();

            polygons
                .attr("d", function (d) {
                    return line(d.points) + "Z";
                })
                .style("cursor", editMode ? "move" : "pointer")
                .select("title")
                .text(function (d) {
                    return d.name || d.id;
                });

            var pointData = [];
            if (data.polygons) {
                data.polygons.forEach(function (polygon) {
                    polygon.points.forEach(function (pt, i) {
                        pointData.push({
                            "index": i,
                            "parent": polygon
                        });
                    });
                });
            }


            var ppointData = [];

            if (data.points) {
                data.points.forEach(function (pt, i) {
                    pointData.push(pt);
                });
            }

            // determine current view scale to make appropriately
            // sized points to drag
            var scale = 1;
            var node = g.node();
            while (node.parentNode) {
                node = node.parentNode;
                if (node.__scale__) {
                    scale = node.__scale__;
                    break;
                }
            }

            /**
             * Custom title
             */
            var textTitle = g.selectAll("text.title")
                .data(data.polygons || [], function (d) {
                    return d.id;
                });
            textTitle.exit().remove();
            textTitle.enter().append("text")
                .attr("class", "title")
                .attr("vector-effect", "non-scaling-stroke")
                .attr('text-anchor', 'middle')
                .attr('fill', 'red')
                .attr('alignment-baseline', 'middle')
                .style("cursor", editMode ? "move" : "pointer")
                .on('contextmenu', d3.contextMenu(menuOverlay))
                .call(dragBehavior);

            textTitle
                .attr('x', function (d) {
                    var maxValue = d3.max(d.points, function(eachPoint){
                        return eachPoint.x;
                    });
                    var minValue = d3.min(d.points, function(eachPoint){
                        return eachPoint.x;
                    });
                    return x((maxValue + minValue) / 2);
                })
                .attr('y', function (d) {
                    var maxValue = d3.max(d.points, function(eachPoint){
                        return eachPoint.y;
                    });
                    var minValue = d3.min(d.points, function(eachPoint){
                        return eachPoint.y;
                    });
                    return y((maxValue + minValue) / 2);
                })
                .text(function (d) {
                    return d.name || d.id;
                });

            var points = g.selectAll("circle.vertex")
                .data(pointData, function (d) {
                    return d.parent ? d.parent.id + "-" + d.index : d.id;
                });

            points.exit().transition()
                .attr("r", 1e-6).remove();

            points.enter().append("circle")
                .attr("class", "vertex")
                .attr("pointer-events", "all")
                .attr("vector-effect", "non-scaling-stroke")
                .style("cursor", "pointer")
                .attr("r", 1e-6)
                .on("mouseup", function (d) {
                    if (d.x && !moved) { //if it is a point node, not part of a drag
                        selectCallbacks.forEach(function (cb) {
                            cb(d.id);
                        });
                    }
                })
                .call(dragBehavior);

            points.attr("cx", function (d) {
                    return x(d.parent ? d.parent.points[d.index].x : d.x);
                }).attr("cy", function (d) {
                    return y(d.parent ? d.parent.points[d.index].y : d.y);
                })
                .attr("r", 3 / scale);
        });
    }


    overlays.xScale = function (scale) {
        if (!arguments.length) return x;
        x = scale;
        return overlays;
    };

    overlays.yScale = function (scale) {
        if (!arguments.length) return y;
        y = scale;
        return overlays;
    };

    overlays.id = function () {
        return id;
    };

    overlays.title = function (n) {
        if (!arguments.length) return name;
        name = n;
        return overlays;
    };

    overlays.visible = function (v) {
        if (!arguments.length) return vis;
        vis = v;
        return overlays;
    };

    overlays.editMode = function (enable) {
        if (!arguments.length) return editMode;
        editMode = enable;
        return overlays;
    };

    overlays.registerCanvasCallback = function (cb) {
        if (arguments.length) canvasCallbacks.push(cb);
        return overlays;
    };

    overlays.registerSelectCallback = function (cb) {
        if (arguments.length) selectCallbacks.push(cb);
        return overlays;
    };

    overlays.registerMoveCallback = function (cb) {
        if (arguments.length) moveCallbacks.push(cb);
        return overlays;
    };

    function __dragItem(d) {
        //prevent drag from starting if not in edit mode
        if (editMode) {
            dragged = d;
            moved = false;
        }
    }

    function __mousemove() {
        if (dragged) {
            var dx = x.invert(d3.event.dx) - x.invert(0);
            var dy = y.invert(d3.event.dy) - y.invert(0);
            moved = true;
            if (dragged.parent) { // a point in a composite object
                dragged.parent.points[dragged.index].x += dx;
                dragged.parent.points[dragged.index].y += dy;
            } else if (dragged.points) { // a composite object
                dragged.points.forEach(function (pt) {
                    pt.x += dx;
                    pt.y += dy;
                });
            } else if (dragged.x) { //an individual point with coords
                dragged.x += dx;
                dragged.y += dy;
            }
            // parent is container for overlays

            overlays(d3.select(this.parentNode));
        }
    }

    function __mouseup() {
        if (dragged && moved) {
            moved = false;
            moveCallbacks.forEach(function (cb) {
                if (dragged.parent) {
                    //polygon point drag
                    cb(dragged.parent.id, dragged.parent.points, dragged.index);
                }
                else if (dragged.points) {
                    //polygon drag
                    cb(dragged.id, dragged.points);
                }
                else {
                    //standalone point drag
                    cb(dragged.id, null);
                }
            });
            dragged = null;
        }
    }

    return overlays;
};
