package datastructure

import "fmt"

type node struct {
	value int
	next  *node
}

type linkedList struct {
	head   *node
	tail   *node
	length int
}

func NewLinkedList() *linkedList {
	L := new(linkedList)
	L.head = nil
	L.tail = nil
	L.length = 0
	return L
}

func ListIsEmpty(L *linkedList) bool {
	if L.head == nil {
		return true
	} else {
		return false
	}
}

func Append(L *linkedList, value int, position int) bool {
	newNode := new(node)
	newNode.value = value
    if position < 0 || position > L.length {
        return fmt.Errorf("无效的位置参数")
    }
	if position == 0 {
		newNode.next = L.head
		L.head = newNode
		if L.tail == nil {
			L.tail = newNode
		}
		L.length++
		return true
	}
	current := L.head
	for i := 0; i < position-1; i++ {
		current = current.next
	}
	newNode.next = current.next
	current.next = newNode

	if newNode.next == nil {
		L.tail = newNode
	}

	if L.tail == current {
		L.tail = newNode
	}
	L.length++

	return true
}

func PrintList(L *linkedList) {
	currentNode := L.head
	for currentNode != nil {
		fmt.Println(currentNode.value)
		currentNode = currentNode.next
	}
}

func DeleteNode(L *linkedList, position int) error {
    if position < 0 || position >= L.length {
        return fmt.Errorf("无效的位置参数")
    }
    if position == 0 {
        L.head = L.head.next
        if L.head == nil {
            L.tail = nil
        }
        L.length--
        return nil
    }
    current := L.head
    for i := 0; i < position-1; i++ {
        current = current.next
    }
    current.next = current.next.next
    if current.next == nil {
        L.tail = current
    }
    L.length--
    return nil
}


func main() {
	L := NewLinkedList()
	Append(L, 1, 0)
	Append(L, 2, 1)
	Append(L, 3, 2)
	Append(L, 4, 3)
	PrintList(L)
}
