using System;
using System.Collections.Generic;
using Cysharp.Threading.Tasks;
using UnityEngine;

[CreateAssetMenu(fileName = "KruskalGenMazeStrategy", menuName = "Strategy/KruskalGenMazeStrategy", order = 0)]
public class KruskalGenMazeStrategy : PathStrategy
{
    public int randomSeed = 0;
    public int delayTime = 200;
    private System.Random random;
    private int mazeCellWidth;
    private int mazeCellHeight;
    private List<Cell> cellList;
    private List<Cell> mazeCells;
    private List<Edge> edges;
    private UFSet ufSet;

    public override string Name()
    {
        return "Kruskal生成迷宫";
    }

    protected override void OnInit()
    {
        random = new System.Random(randomSeed);
        cellList = StrategyManager.Instance.cells;
        var width = StrategyManager.Instance.width;
        var height = StrategyManager.Instance.height;
        // 为了迷宫美观，确保宽度和高度都是奇数
        if (width % 2 == 0)
        {
            width++;
        }
        if (height % 2 == 0)
        {
            height++;
        }
        MainPanel.Instance.GenerateGrid(width, height);
        mazeCellWidth = (width + 1) >> 1;
        mazeCellHeight = (height + 1) >> 1;
        mazeCells = new List<Cell>(mazeCellWidth * mazeCellHeight);
        edges = new List<Edge>(mazeCellHeight * mazeCellWidth / 2);
        foreach (var cell in cellList)
        {
            if (cell.x % 2 == 1 || cell.y % 2 == 1)
            {
                cell.SetCellType(CellType.Wall);
                if (!(cell.x % 2 == 1 && cell.y % 2 == 1))
                {
                    if (cell.x % 2 == 1)
                    {
                        edges.Add(new Edge(cellList[cell.y * width + cell.x - 1], cellList[cell.y * width + cell.x + 1], cell));
                    }
                    else
                    {
                        edges.Add(new Edge(cellList[cell.y * width + cell.x - width], cellList[cell.y * width + cell.x + width], cell));
                    }
                }
            }
            else
            {
                cell.SetCellType(CellType.Normal);
                mazeCells.Add(cell);
            }
        }
        GenMaze().Forget();
    }

    public async UniTask GenMaze()
    {
        MainPanel.Instance.ShowMask(true);
        await GenMazeInternal();
        MainPanel.Instance.ShowMask(false);
    }

    private async UniTask GenMazeInternal()
    {
        ufSet = new UFSet(mazeCells.Count);
        while (edges.Count > 0)
        {
            var edge = edges[random.Next(0, edges.Count)];
            var cell1Index = edge.cell1.y / 2 * mazeCellWidth + edge.cell1.x / 2;
            var cell2Index = edge.cell2.y / 2 * mazeCellWidth + edge.cell2.x / 2;
            if (ufSet.Find(cell1Index) != ufSet.Find(cell2Index))
            {
                ufSet.Union(cell1Index, cell2Index);
                edge.wall.SetCellType(CellType.Normal);
                edges.Remove(edge);
                await UniTask.Delay(delayTime);
            }
            else
            {
                edges.Remove(edge);
            }
        }
        await UniTask.CompletedTask;
        Debug.Log("GenMazeInternal done");
    }

    protected override void OnDestroy()
    {
        base.OnDestroy();
    }
}

public class Edge
{
    public Cell cell1;
    public Cell cell2;
    public Cell wall;
    public Edge(Cell cell1, Cell cell2, Cell wall)
    {
        this.cell1 = cell1;
        this.cell2 = cell2;
        this.wall = wall;
    }
}

public class UFSet
{
    private int[] elementSets;
    public UFSet(int size = 10)
    {
        elementSets = new int[size];
        for (int i = 0; i < size; i++)
        {
            elementSets[i] = -1;
        }
    }

    public int Find(int x)
    {
        while (elementSets[x] >= 0)
        {
            x = elementSets[x];
        }
        return x;
    }

    public void Union(int element1, int element2)
    {
        int root1 = Find(element1);
        int root2 = Find(element2);
        elementSets[root1] += elementSets[root2];
        elementSets[root2] = root1;
    }
}